/**
 * Chapters: the player's `chapters` attribute puts a hidden chapters track
 * on the video, the seek bar divides its track at the boundaries and names
 * the chapter in the preview, and the chapters menu lists them. The
 * chapters are the browser's own text track, so a page's `addTextTrack`
 * works the same way, which is how most of these tests supply them.
 */
import type { MbxChaptersMenu, MbxSeekBar } from '@mattebox/player';
import { MatteboxPlayerElement } from '@mattebox/player';
import type { Handler } from '@mattebox/player-core';
import { nativeHandler } from '@mattebox/player-core';
import { afterEach, describe, expect, it } from 'vitest';
import { fakeMedia, media, once } from './helpers.js';

/**
 * The chapter files, served over HTTP the way a page serves them: WebKit
 * locks up on a blob-backed track element removed and recreated in one
 * tick, and no page does that.
 */
/**
 * Playwright's WebKit build locks up when a track element joins a video
 * that is already loading, which two tests here do; the same path works
 * in Chromium, Firefox, and in WebKit through the demo. Skipped there.
 */
const WEBKIT = /AppleWebKit/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

function vtt(name = 'chapters'): string {
  return new URL(`./fixtures/${name}.vtt`, import.meta.url).href;
}

/** A source for a handler that never reads it: the element loads on any `src`. */
const SOURCE = 'https://cdn.test/source';

/** A handler that claims the source and touches no video: a session, so a reload would show. */
function quietHandler(): Handler {
  return {
    name: 'quiet',
    canHandle: () => 'probably',
    handle: () =>
      Promise.resolve({ handler: 'quiet', engine: null, dispose: () => Promise.resolve() }),
  };
}

/** The element over `handlers` and a deterministic video, see `fakeMedia` in helpers.ts. */
function build(
  handlers: readonly Handler[],
  attributes: Readonly<Record<string, string>>,
): MatteboxPlayerElement {
  const player = new MatteboxPlayerElement({ handlers });
  fakeMedia(player.video);
  for (const [name, value] of Object.entries(attributes)) player.setAttribute(name, value);
  document.body.append(player);
  return player;
}

/** The element under custom controls with the metadata of a ten-second clip in, ready to play. */
async function ready(
  attributes: Readonly<Record<string, string>> = {},
): Promise<MatteboxPlayerElement> {
  const player = build([quietHandler()], {
    controls: 'custom',
    muted: '',
    src: SOURCE,
    ...attributes,
  });
  await expect.poll(() => player.player?.session ?? null).not.toBeNull();
  await media(player.video).metadata(10);
  return player;
}

/** Three chapters on the video, the way a page adds them from script. */
function addChapters(player: MatteboxPlayerElement): TextTrack {
  const track = player.video.addTextTrack('chapters');
  track.mode = 'hidden';
  track.addCue(new VTTCue(0, 4, 'Opening'));
  track.addCue(new VTTCue(4, 7, 'Middle'));
  track.addCue(new VTTCue(7, 10, 'Ending'));
  return track;
}

function seekBar(player: MatteboxPlayerElement): MbxSeekBar {
  const bar = player.querySelector('mbx-seek-bar');
  if (bar === null) throw new Error('no seek bar');
  return bar;
}

function chaptersMenu(player: MatteboxPlayerElement): MbxChaptersMenu {
  const menu = player.querySelector('mbx-chapters-menu');
  if (menu === null) throw new Error('no chapters menu');
  return menu;
}

function inside(node: HTMLElement, part: string): HTMLElement {
  return node.shadowRoot?.querySelector(`[part~="${part}"]`) as HTMLElement;
}

function items(node: HTMLElement): HTMLButtonElement[] {
  return [
    ...(node.shadowRoot?.querySelectorAll<HTMLButtonElement>('[part~="popup"] button') ?? []),
  ];
}

function mask(bar: MbxSeekBar): string {
  const track = inside(bar, 'track');
  return (
    track.style.getPropertyValue('mask-image') || track.style.getPropertyValue('-webkit-mask-image')
  );
}

function hover(bar: MbxSeekBar, fraction: number): void {
  const rect = inside(bar, 'rail').getBoundingClientRect();
  inside(bar, 'slider').dispatchEvent(
    new PointerEvent('pointermove', {
      bubbles: true,
      clientX: rect.left + rect.width * fraction,
      clientY: rect.top + rect.height / 2,
    }),
  );
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('the chapters attribute', () => {
  it.skipIf(WEBKIT)(
    'puts a hidden chapters track on the video, swaps its source, and takes it away',
    async () => {
      const player = await ready({ chapters: vtt() });
      const track = player.video.querySelector('track');
      expect(track?.kind).toBe('chapters');
      expect(track?.track.mode).toBe('hidden');
      await expect.poll(() => track?.track.cues?.length ?? 0, { timeout: 5000 }).toBe(3);
      const next = vtt('chapters-two');
      player.setAttribute('chapters', next);
      expect(player.video.querySelectorAll('track').length).toBe(1);
      expect(player.video.querySelector('track')?.src).toBe(next);
      await expect
        .poll(() => player.video.querySelector('track')?.track.cues?.length ?? 0, { timeout: 5000 })
        .toBe(2);
      player.removeAttribute('chapters');
      expect(player.video.querySelector('track')).toBeNull();
    },
  );

  it('comes back after an engine that empties the video on attach', async () => {
    // The engine's attach removes every child of the media element; a
    // handler that does the same stands in for it.
    const emptying: Handler = {
      name: 'emptying',
      canHandle: () => 'probably',
      async handle(_source, video) {
        // Once the first track has loaded, as the engine's attach comes
        // after the chain resolves.
        await new Promise<void>((resolve) => {
          const tick = (): void => {
            const cues = video.querySelector('track')?.track.cues?.length ?? 0;
            if (cues === 3) resolve();
            else setTimeout(tick, 20);
          };
          tick();
        });
        while (video.firstChild) video.firstChild.remove();
        return { handler: 'emptying', engine: null, dispose: () => Promise.resolve() };
      },
    };
    const player = build([emptying], {
      controls: 'custom',
      muted: '',
      chapters: vtt(),
      src: SOURCE,
    });
    await expect.poll(() => player.player?.session?.handler ?? null).toBe('emptying');
    await expect.poll(() => player.video.querySelector('track')?.kind ?? null).toBe('chapters');
    await expect
      .poll(() => player.video.querySelector('track')?.track.cues?.length ?? 0, { timeout: 5000 })
      .toBe(3);
    await expect.poll(() => chaptersMenu(player).hidden).toBe(false);
  });

  it.skipIf(WEBKIT)('never reloads the source', async () => {
    const player = await ready();
    let changes = 0;
    player.addEventListener('sourcechange', () => {
      changes += 1;
    });
    player.setAttribute('chapters', vtt());
    // Until the cues are in: WebKit locks up when a track is torn down mid-load.
    await expect
      .poll(() => player.video.querySelector('track')?.track.cues?.length ?? 0, { timeout: 5000 })
      .toBe(3);
    expect(changes).toBe(0);
  });
});

describe('the seek bar with chapters', () => {
  it('cuts a gap at each boundary between chapters, and none without them', async () => {
    const player = await ready();
    const bar = seekBar(player);
    expect(mask(bar)).toBe('');
    addChapters(player);
    await expect.poll(() => mask(bar)).toContain('linear-gradient');
    // Two boundaries for three chapters: at 40% and at 70% of ten seconds.
    const value = mask(bar);
    expect(value).toContain('40%');
    expect(value).toContain('70%');
    // Two gaps, each clear between two stops.
    expect(value.split('transparent').length - 1).toBe(4);
  });

  it('leaves the track whole under chapters="none"', async () => {
    const player = await ready();
    const bar = seekBar(player);
    bar.setAttribute('chapters', 'none');
    addChapters(player);
    await new Promise((resolve) => setTimeout(resolve, 0));
    player.video.dispatchEvent(new Event('timeupdate'));
    expect(mask(bar)).toBe('');
    bar.removeAttribute('chapters');
    expect(mask(bar)).toContain('linear-gradient');
  });

  it('names the chapter under the pointer in the preview', async () => {
    const player = await ready();
    const bar = seekBar(player);
    addChapters(player);
    player.video.dispatchEvent(new Event('timeupdate'));
    hover(bar, 0.5);
    expect(inside(bar, 'preview').hidden).toBe(false);
    expect(inside(bar, 'preview-title').hidden).toBe(false);
    expect(inside(bar, 'preview-title').textContent).toBe('Middle');
    hover(bar, 0.9);
    expect(inside(bar, 'preview-title').textContent).toBe('Ending');
    bar.setAttribute('chapters', 'none');
    hover(bar, 0.9);
    expect(inside(bar, 'preview-title').hidden).toBe(true);
  });

  it('follows a track that arrives later', async () => {
    const player = await ready();
    const bar = seekBar(player);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const track = player.video.addTextTrack('chapters');
    track.addCue(new VTTCue(0, 5, 'One'));
    track.addCue(new VTTCue(5, 10, 'Two'));
    // A disabled track loads no cues; the readers set it hidden.
    await expect.poll(() => track.mode).toBe('hidden');
    await expect.poll(() => mask(bar)).toContain('50%');
  });
});

describe('the chapters menu', () => {
  it('hides without chapters, and lists them with their start times', async () => {
    const player = await ready();
    const menu = chaptersMenu(player);
    expect(menu.hidden).toBe(true);
    addChapters(player);
    await expect.poll(() => menu.hidden).toBe(false);
    const list = items(menu);
    expect(list.map((item) => item.firstChild?.textContent)).toEqual([
      'Opening',
      'Middle',
      'Ending',
    ]);
    expect(list.map((item) => item.querySelector('[part~="item-detail"]')?.textContent)).toEqual([
      '0:00',
      '0:04',
      '0:07',
    ]);
    expect(inside(menu, 'button').getAttribute('aria-label')).toBe('Chapters');
    menu.setAttribute('label', 'Capítols');
    expect(inside(menu, 'button').getAttribute('aria-label')).toBe('Capítols');
  });

  it('checks the chapter the playhead is in, and seeks to the one chosen', async () => {
    const player = await ready();
    const menu = chaptersMenu(player);
    addChapters(player);
    await expect.poll(() => menu.hidden).toBe(false);
    expect(items(menu)[0]?.getAttribute('aria-checked')).toBe('true');
    player.video.currentTime = 5;
    await once(player.video, 'seeked');
    expect(items(menu)[1]?.getAttribute('aria-checked')).toBe('true');
    inside(menu, 'button').click();
    expect(menu.hasAttribute('open')).toBe(true);
    items(menu)[2]?.click();
    await once(player.video, 'seeked');
    expect(player.video.currentTime).toBe(7);
    expect(menu.hasAttribute('open')).toBe(false);
    expect(items(menu)[2]?.getAttribute('aria-checked')).toBe('true');
  });

  it('works under native controls, in the panels row', async () => {
    const player = build([nativeHandler()], { muted: '' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const menu = player.querySelector('mbx-panels > mbx-chapters-menu');
    expect(menu).not.toBeNull();
    expect((menu as HTMLElement).hidden).toBe(true);
    addChapters(player);
    await expect.poll(() => (menu as HTMLElement).hidden).toBe(false);
    await expect.poll(() => player.querySelector('mbx-panels')?.hidden).toBe(false);
  });
});
