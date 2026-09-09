import { MatteboxPlayerElement } from '@mattebox/player';
import { nativeHandler } from '@mattebox/player-core';
import type { Mattebox } from 'mattebox';
import type { ThumbnailsApi } from 'mattebox/stages/thumbnails';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fullscreenButton, pipButton } from '../../src/controls/buttons.js';
import { cueLift } from '../../src/controls/cues.js';
import { liveButton } from '../../src/controls/live.js';
import { menu } from '../../src/controls/menu.js';
import { drmBadge, textMenu } from '../../src/controls/menus.js';
import { DEFAULTS } from '../../src/controls/options.js';
import { seekBar } from '../../src/controls/seek.js';
import { clock } from '../../src/controls/time.js';
import type { LiveApi } from '../../src/namespaces.js';
import { once, silence } from './helpers.js';

/** The element over the native handler alone: nothing here needs an engine. */
function mount(attributes: Readonly<Record<string, string>> = {}): MatteboxPlayerElement {
  const player = new MatteboxPlayerElement({ handlers: [nativeHandler()] });
  for (const [name, value] of Object.entries(attributes)) player.setAttribute(name, value);
  document.body.append(player);
  return player;
}

function bar(player: MatteboxPlayerElement): HTMLElement | null {
  return player.shadowRoot?.querySelector('[part~="controls"]') ?? null;
}

function idle(player: MatteboxPlayerElement): boolean {
  return bar(player)?.getAttribute('part')?.split(' ').includes('idle') ?? false;
}

function part(player: MatteboxPlayerElement, name: string): HTMLElement | null {
  return player.shadowRoot?.querySelector(`[part~="${name}"]`) ?? null;
}

/** The glyph a button shows, by its part name. */
function shown(button: HTMLElement | null): string {
  const names = button?.firstElementChild?.getAttribute('part')?.split(' ') ?? [];
  return names.find((name) => name.endsWith('-icon')) ?? '';
}

/** A key as the browser sends it: cancelable, so a control's preventDefault reaches the host's listener. */
function press(target: EventTarget, key: string): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }),
  );
}

/** The element ready to play: a native session over the WAV, muted so the autoplay policy allows it. */
async function ready(seconds?: number): Promise<MatteboxPlayerElement> {
  const player = mount({ controls: 'custom', src: silence(seconds), muted: '' });
  await once(player.video, 'loadedmetadata');
  return player;
}

function move(target: EventTarget): void {
  target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, composed: true }));
}

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('the controls attribute', () => {
  it('keeps native controls on the video and draws no bar by default', () => {
    const player = mount();
    expect(player.video.hasAttribute('controls')).toBe(true);
    expect(bar(player)).toBeNull();
  });

  it('keeps native controls with controls="native"', () => {
    const player = mount({ controls: 'native' });
    expect(player.video.hasAttribute('controls')).toBe(true);
    expect(bar(player)).toBeNull();
  });

  it('removes native controls and draws the bar over the stage with controls="custom"', () => {
    const player = mount({ controls: 'custom' });
    expect(player.video.hasAttribute('controls')).toBe(false);
    const root = bar(player);
    expect(root).not.toBeNull();
    expect(root?.parentElement?.getAttribute('part')).toBe('stage');
  });

  it('removes native controls and draws no bar with controls="none"', () => {
    const player = mount({ controls: 'none' });
    expect(player.video.hasAttribute('controls')).toBe(false);
    expect(bar(player)).toBeNull();
  });

  it('swaps the bar in and out as the attribute changes, without reloading the source', async () => {
    const player = mount({ src: silence(), muted: '' });
    let changes = 0;
    player.addEventListener('sourcechange', () => {
      changes += 1;
    });
    await once(player, 'sourcechange');
    await once(player.video, 'loadedmetadata');
    const loaded = player.video.currentSrc;

    player.setAttribute('controls', 'custom');
    expect(player.video.hasAttribute('controls')).toBe(false);
    expect(bar(player)).not.toBeNull();
    player.setAttribute('controls', 'none');
    expect(bar(player)).toBeNull();
    player.removeAttribute('controls');
    expect(player.video.hasAttribute('controls')).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(changes).toBe(1);
    expect(player.video.currentSrc).toBe(loaded);
  });
});

describe('the bar while idle', () => {
  it('hides after DEFAULTS.idleMs of stillness while playing, and wakes on pointer movement', async () => {
    const player = mount({ controls: 'custom', src: silence(), muted: '' });
    await once(player, 'sourcechange');
    await once(player.video, 'loadedmetadata');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    // The clip is an eighth of a second: looped, so it never ends under the timer.
    player.video.loop = true;
    await player.video.play();
    expect(idle(player)).toBe(false);

    vi.advanceTimersByTime(DEFAULTS.idleMs);
    expect(idle(player)).toBe(true);

    move(player.video);
    expect(idle(player)).toBe(false);
  });

  it('never hides while paused', () => {
    const player = mount({ controls: 'custom' });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    move(player.video);
    vi.advanceTimersByTime(DEFAULTS.idleMs * 2);
    expect(idle(player)).toBe(false);
  });

  it('holds while keyboard focus is inside it, and lets go once a pointer takes over', async () => {
    const player = mount({ controls: 'custom', src: silence(), muted: '' });
    await once(player, 'sourcechange');
    await once(player.video, 'loadedmetadata');
    // The clip is an eighth of a second: looped, so it never ends under the timer.
    player.video.loop = true;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await player.video.play();
    const play = part(player, 'play-button') as HTMLElement;
    // A key, then focus inside: a keyboard user reading the bar.
    player.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    play.focus();
    vi.advanceTimersByTime(DEFAULTS.idleMs * 2);
    expect(idle(player)).toBe(false);

    // A pointer press, with focus still on the button: a mouse user who clicked it.
    play.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    vi.advanceTimersByTime(DEFAULTS.idleMs);
    expect(idle(player)).toBe(true);
  });

  it('is not held by the pointer leaving: the timer alone hides it', async () => {
    const player = mount({ controls: 'custom', src: silence(), muted: '' });
    await once(player, 'sourcechange');
    await once(player.video, 'loadedmetadata');
    player.video.loop = true;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await player.video.play();
    const stage = player.shadowRoot?.querySelector('[part~="stage"]') as HTMLElement;
    move(player.video);
    stage.dispatchEvent(new PointerEvent('pointerleave'));
    expect(idle(player)).toBe(false);
    vi.advanceTimersByTime(DEFAULTS.idleMs);
    expect(idle(player)).toBe(true);
  });

  it('holds while a menu is open, and hides once it closes', async () => {
    const player = mount({ controls: 'custom', src: silence(), muted: '' });
    await once(player, 'sourcechange');
    await once(player.video, 'loadedmetadata');
    player.video.loop = true;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await player.video.play();
    (part(player, 'speed-button') as HTMLButtonElement).click();
    vi.advanceTimersByTime(DEFAULTS.idleMs * 2);
    expect(idle(player)).toBe(false);
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    vi.advanceTimersByTime(DEFAULTS.idleMs);
    expect(idle(player)).toBe(true);
  });

  it('stops listening once the bar is removed', () => {
    const player = mount({ controls: 'custom' });
    const root = bar(player);
    player.removeAttribute('controls');
    move(player.video);
    expect(root?.isConnected).toBe(false);
  });
});

describe('the buttons row', () => {
  it('plays and pauses from the play button, swapping the glyph and the name', async () => {
    const player = await ready();
    player.video.loop = true;
    const play = part(player, 'play-button');
    expect(play?.getAttribute('aria-label')).toBe('Play');
    expect(shown(play)).toBe('play-icon');

    play?.click();
    await once(player.video, 'play');
    expect(player.video.paused).toBe(false);
    expect(play?.getAttribute('aria-label')).toBe('Pause');
    expect(shown(play)).toBe('pause-icon');
    expect(bar(player)?.getAttribute('part')?.split(' ')).toContain('playing');

    play?.click();
    await once(player.video, 'pause');
    expect(player.video.paused).toBe(true);
    expect(shown(play)).toBe('play-icon');
  });

  it('offers replay once the media has ended', async () => {
    const player = await ready();
    await player.video.play();
    await once(player.video, 'ended');
    const play = part(player, 'play-button');
    expect(play?.getAttribute('aria-label')).toBe('Replay');
    expect(shown(play)).toBe('replay-icon');
  });

  it('mutes and unmutes from the mute button, with the pressed state', async () => {
    const player = mount({ controls: 'custom' });
    const mute = part(player, 'mute-button');
    expect(mute?.getAttribute('aria-pressed')).toBe('false');
    expect(mute?.getAttribute('aria-label')).toBe('Mute');

    mute?.click();
    await once(player.video, 'volumechange');
    expect(player.video.muted).toBe(true);
    expect(mute?.getAttribute('aria-pressed')).toBe('true');
    expect(mute?.getAttribute('aria-label')).toBe('Unmute');
    expect(shown(mute)).toBe('mute-icon');
    expect(bar(player)?.getAttribute('part')?.split(' ')).toContain('muted');

    mute?.click();
    await once(player.video, 'volumechange');
    expect(player.video.muted).toBe(false);
  });

  it('draws the level in the mute glyph', async () => {
    const player = mount({ controls: 'custom' });
    const mute = part(player, 'mute-button');
    expect(shown(mute)).toBe('volume-high-icon');
    player.video.volume = 0.3;
    await once(player.video, 'volumechange');
    expect(shown(mute)).toBe('volume-low-icon');
    player.video.volume = 0;
    await once(player.video, 'volumechange');
    expect(shown(mute)).toBe('mute-icon');
  });

  it('moves the volume with the keys and reads it back', async () => {
    const player = mount({ controls: 'custom' });
    const volume = part(player, 'volume');
    expect(volume?.getAttribute('role')).toBe('slider');
    expect(volume?.getAttribute('aria-valuenow')).toBe('1');

    press(volume as EventTarget, 'ArrowLeft');
    await once(player.video, 'volumechange');
    expect(player.video.volume).toBeCloseTo(0.95, 5);
    expect(volume?.getAttribute('aria-valuenow')).toBe('0.95');
    expect(volume?.getAttribute('aria-valuetext')).toBe('95%');

    press(volume as EventTarget, 'Home');
    await once(player.video, 'volumechange');
    expect(player.video.volume).toBe(0);
    press(volume as EventTarget, 'PageUp');
    await once(player.video, 'volumechange');
    expect(player.video.volume).toBeCloseTo(0.2, 5);
  });

  it('sets the volume where the pointer lands, and unmutes', async () => {
    const player = mount({ controls: 'custom', muted: '' });
    // The slider unfolds from its group under the pointer or focus.
    (part(player, 'mute-button') as HTMLElement).focus();
    const volume = part(player, 'volume') as HTMLElement;
    const rail = part(player, 'volume-rail') as HTMLElement;
    await expect.poll(() => rail.getBoundingClientRect().width).toBeGreaterThan(40);
    const rect = rail.getBoundingClientRect();
    volume.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: rect.left + rect.width * 0.25,
        clientY: rect.top + rect.height / 2,
      }),
    );
    await once(player.video, 'volumechange');
    expect(player.video.volume).toBeCloseTo(0.25, 1);
    expect(player.video.muted).toBe(false);
  });

  it('shows the time against the duration once the metadata is in', async () => {
    const player = await ready();
    expect(part(player, 'current-time')?.textContent).toBe('0:00');
    expect(part(player, 'duration')?.textContent).toBe('0:00');
    expect(part(player, 'duration')?.hidden).toBe(false);
  });

  it('shows the fullscreen button exactly when an API exists', () => {
    const player = mount({ controls: 'custom' });
    const button = part(player, 'fullscreen-button');
    const host: object = player;
    const video: object = player.video;
    const supported =
      'requestFullscreen' in host ||
      'webkitRequestFullscreen' in host ||
      'webkitEnterFullscreen' in video;
    expect(button?.hidden).toBe(!supported);
    expect(button?.getAttribute('aria-label')).toBe('Enter fullscreen');
  });

  it('names every element in the bar, and hides every glyph from the accessibility tree', () => {
    const player = mount({ controls: 'custom' });
    // The path inside a glyph is its geometry, not an element of its own:
    // `::part(icon)` styles the glyph whole.
    const nodes = [...(bar(player)?.querySelectorAll('*') ?? [])].filter(
      (node) => node.tagName !== 'path',
    );
    expect(nodes.length).toBeGreaterThan(5);
    for (const node of nodes) expect(node.getAttribute('part')).not.toBeNull();
    for (const svg of bar(player)?.querySelectorAll('svg') ?? []) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    }
    // A button is named by its label, or by the text it shows, as a menu item is.
    for (const button of bar(player)?.querySelectorAll('button') ?? []) {
      expect(button.getAttribute('aria-label') ?? button.textContent).not.toBe('');
      expect(button.getAttribute('aria-label') ?? button.textContent).not.toBeNull();
    }
  });
});

describe('the seek bar', () => {
  it('maps the duration once the metadata is in, and reads the position', async () => {
    const player = await ready(10);
    const seek = part(player, 'seek');
    expect(seek?.getAttribute('role')).toBe('slider');
    expect(seek?.getAttribute('aria-valuemin')).toBe('0');
    expect(seek?.getAttribute('aria-valuemax')).toBe('10');
    expect(seek?.getAttribute('aria-valuenow')).toBe('0');
    expect(seek?.getAttribute('aria-valuetext')).toBe('0:00 of 0:10');
  });

  it('seeks with the keys', async () => {
    const player = await ready(10);
    const seek = part(player, 'seek') as EventTarget;
    press(seek, 'ArrowRight');
    await once(player.video, 'seeked');
    expect(player.video.currentTime).toBeCloseTo(5, 1);
    press(seek, 'ArrowLeft');
    await once(player.video, 'seeked');
    expect(player.video.currentTime).toBeCloseTo(0, 1);
    press(seek, 'End');
    await once(player.video, 'seeked');
    expect(player.video.currentTime).toBeCloseTo(10, 1);
    press(seek, 'PageDown');
    await once(player.video, 'seeked');
    expect(player.video.currentTime).toBeCloseTo(0, 1);
  });

  it('seeks where the pointer lands, and the played layer follows the pointer meanwhile', async () => {
    const player = await ready(10);
    const seek = part(player, 'seek') as HTMLElement;
    const rect = (part(player, 'seek-rail') as HTMLElement).getBoundingClientRect();
    expect(rect.width).toBeGreaterThan(0);
    const y = rect.top + rect.height / 2;
    seek.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: rect.left + rect.width * 0.5,
        clientY: y,
      }),
    );
    expect(seek.getAttribute('part')?.split(' ')).toContain('dragging');
    expect(part(player, 'seek-fill')?.style.width).toBe('50%');
    seek.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        clientX: rect.left + rect.width * 0.8,
        clientY: y,
      }),
    );
    expect(seek.getAttribute('part')?.split(' ')).not.toContain('dragging');
    await once(player.video, 'seeked');
    expect(player.video.currentTime).toBeCloseTo(8, 0);
  });

  it('draws the buffered ranges on the track', async () => {
    const player = await ready(10);
    await expect
      .poll(() => part(player, 'buffered-range')?.style.width ?? '')
      .toMatch(/^(100|9\d(\.\d+)?)%$/);
  });

  it('shows the hover time above the pointer', async () => {
    const player = await ready(10);
    const seek = part(player, 'seek') as HTMLElement;
    const rect = (part(player, 'seek-rail') as HTMLElement).getBoundingClientRect();
    seek.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + rect.width * 0.25,
        clientY: rect.top + rect.height / 2,
      }),
    );
    expect(part(player, 'hover')?.hidden).toBe(false);
    expect(part(player, 'hover')?.style.left).toBe('25%');
    expect(part(player, 'preview')?.hidden).toBe(false);
    expect(part(player, 'preview-time')?.textContent).toBe('0:02');
    expect(part(player, 'preview-image')?.hidden).toBe(true);
    seek.dispatchEvent(new PointerEvent('pointerleave'));
    expect(part(player, 'hover')?.hidden).toBe(true);
    expect(part(player, 'preview')?.hidden).toBe(true);
  });

  it('shows no live edge and no live button without a live session', async () => {
    const player = await ready(10);
    expect(part(player, 'edge')?.hidden).toBe(true);
    expect(part(player, 'live-button')?.hidden).toBe(true);
    expect(bar(player)?.getAttribute('part')?.split(' ')).not.toContain('live');
  });
});

describe('the seek bar over a live session', () => {
  /** A live namespace over the WAV: the window is what the video reports seekable. */
  function stub(edge: number | null, atEdge = false): LiveApi & { seeks: number } {
    const api = {
      edge,
      latency: null,
      atEdge,
      seeks: 0,
      seekToEdge(): void {
        api.seeks += 1;
      },
    };
    return api;
  }

  async function video(): Promise<HTMLVideoElement> {
    const node = document.createElement('video');
    node.muted = true;
    node.src = silence(10);
    document.body.append(node);
    await once(node, 'loadedmetadata');
    return node;
  }

  it('maps the seekable window, marks the edge and reads the distance behind it', async () => {
    const media = await video();
    const flags: Record<string, boolean> = {};
    const seek = seekBar(
      media,
      (name, on) => {
        flags[name] = on;
      },
      DEFAULTS,
    );
    document.body.append(seek.root);
    // A 10 s window over a 2 s goal is five goals: worth a bar.
    seek.attach({ live: stub(8), bufferGoal: () => 2 });
    expect(flags.live).toBe(true);
    expect(flags.seekable).toBe(true);
    const edge = seek.root.querySelector('[part~="edge"]') as HTMLElement;
    expect(edge.hidden).toBe(false);
    expect(edge.style.left).toBe('80%');
    const slider = seek.root.querySelector('[part~="seek"]');
    expect(slider?.getAttribute('aria-valuetext')).toBe('0:10 behind live');

    seek.detach();
    expect(flags.live).toBe(false);
    expect(edge.hidden).toBe(true);
    seek.dispose();
  });

  it('shows the live button once there is a window, disabled at the edge, seeking on click', async () => {
    const media = await video();
    const live = liveButton(media);
    document.body.append(live.root);
    expect(live.root.hidden).toBe(true);

    live.attach(stub(null));
    expect(live.root.hidden).toBe(true);

    const api = stub(8);
    live.attach(api);
    expect(live.root.hidden).toBe(false);
    expect((live.root as HTMLButtonElement).disabled).toBe(false);
    live.root.click();
    expect(api.seeks).toBe(1);

    live.attach(stub(8, true));
    expect((live.root as HTMLButtonElement).disabled).toBe(true);
    expect(live.root.getAttribute('part')?.split(' ')).toContain('at-edge');
    const dot = live.root.querySelector('[part~="live-dot"]');
    expect(dot?.getAttribute('part')?.split(' ')).toContain('at-edge');

    // Without a seek bar there is nowhere to come back from: red and inert, behind or not.
    live.attach(stub(8, false));
    live.seekable(false);
    expect((live.root as HTMLButtonElement).disabled).toBe(true);
    expect(dot?.getAttribute('part')?.split(' ')).toContain('at-edge');
    live.seekable(true);
    expect((live.root as HTMLButtonElement).disabled).toBe(false);
    live.dispose();
  });
});

describe('the preview over a thumbnail track', () => {
  /** A track with one tile over the whole clip: a 320 by 180 rectangle at (320, 0) of a sprite. */
  function track(): ThumbnailsApi {
    const tile = {
      url: 'https://cdn.example/sprite.jpg',
      start: 0,
      end: 10,
      x: 320,
      y: 0,
      width: 320,
      height: 180,
    };
    return {
      load: () => Promise.resolve(1),
      at: (time: number) => (time >= 0 && time < 10 ? tile : null),
      all: [tile],
    };
  }

  async function seekOver(seconds: number) {
    const media = document.createElement('video');
    media.muted = true;
    media.src = silence(seconds);
    document.body.append(media);
    await once(media, 'loadedmetadata');
    const seek = seekBar(media, () => undefined, DEFAULTS);
    // Wide, so the preview has room to sit centred under the pointer.
    seek.root.style.width = '600px';
    document.body.append(seek.root);
    return seek;
  }

  function hover(row: HTMLElement, fraction: number): void {
    const seek = row.querySelector('[part~="seek"]') as HTMLElement;
    const rect = (row.querySelector('[part~="seek-rail"]') as HTMLElement).getBoundingClientRect();
    seek.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + rect.width * fraction,
        clientY: rect.top + rect.height / 2,
      }),
    );
  }

  it('draws the tile above the pointer, scaled to the preview width', async () => {
    const seek = await seekOver(10);
    seek.attach({ thumbnails: track() });
    hover(seek.root, 0.5);
    const image = seek.root.querySelector('[part~="preview-image"]') as HTMLElement;
    const tile = seek.root.querySelector('[part~="preview-tile"]') as HTMLElement;
    expect(image.hidden).toBe(false);
    expect(image.style.width).toBe('160px');
    expect(image.style.height).toBe('90px');
    expect(tile.style.backgroundImage).toContain('sprite.jpg');
    expect(tile.style.backgroundPosition).toBe('-320px 0px');
    expect(tile.style.transform).toBe('scale(0.5)');
    expect(seek.root.querySelector('[part~="preview-time"]')?.textContent).toBe('0:05');
    seek.dispose();
  });

  it('honours --mbx-preview-width', async () => {
    const seek = await seekOver(10);
    seek.root.style.setProperty('--mbx-preview-width', '320px');
    seek.attach({ thumbnails: track() });
    hover(seek.root, 0.5);
    const image = seek.root.querySelector('[part~="preview-image"]') as HTMLElement;
    expect(image.style.width).toBe('320px');
    expect(image.style.height).toBe('180px');
    seek.dispose();
  });

  it('shows the time alone where the track has no tile, and after detach', async () => {
    const seek = await seekOver(20);
    seek.attach({ thumbnails: track() });
    hover(seek.root, 0.75);
    const image = seek.root.querySelector('[part~="preview-image"]') as HTMLElement;
    expect(image.hidden).toBe(true);
    expect(seek.root.querySelector('[part~="preview-time"]')?.textContent).toBe('0:15');

    hover(seek.root, 0.25);
    expect(image.hidden).toBe(false);
    seek.detach();
    expect((seek.root.querySelector('[part~="preview"]') as HTMLElement).hidden).toBe(true);
    hover(seek.root, 0.25);
    expect(image.hidden).toBe(true);
    seek.dispose();
  });
});

describe('the menu primitive', () => {
  function build() {
    const chosen: string[] = [];
    const control = menu({ name: 'quality', label: 'Quality', icon: 'settings' });
    control.fill([
      {
        name: 'rendition',
        items: [
          ['auto', 'Auto'],
          ['v1', '270p'],
          ['v2', '720p'],
        ],
        value: 'v1',
        onSelect(value: string): void {
          chosen.push(value);
        },
      },
    ]);
    document.body.append(control.root);
    const button = control.root.querySelector('button') as HTMLButtonElement;
    const popup = control.root.querySelector('[role="menu"]') as HTMLElement;
    const items = () => [...popup.querySelectorAll('button')];
    return { control, button, popup, items, chosen };
  }

  it('names the button and the items the way a menu is named', () => {
    const { button, popup, items } = build();
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-label')).toBe('Quality');
    expect(popup.getAttribute('role')).toBe('menu');
    expect(items().map((item) => item.getAttribute('role'))).toEqual([
      'menuitemradio',
      'menuitemradio',
      'menuitemradio',
    ]);
    expect(items().map((item) => item.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(items()[1]?.getAttribute('part')?.split(' ')).toContain('checked');
  });

  it('opens on the checked item, moves with the arrows, chooses on Enter, and returns focus', () => {
    const { button, popup, items, chosen } = build();
    button.click();
    expect(popup.hidden).toBe(false);
    expect(document.activeElement).toBe(items()[1]);

    press(popup, 'ArrowDown');
    expect(document.activeElement).toBe(items()[2]);
    press(popup, 'ArrowDown');
    expect(document.activeElement).toBe(items()[0]);
    press(popup, 'End');
    expect(document.activeElement).toBe(items()[2]);

    (document.activeElement as HTMLButtonElement).click();
    expect(chosen).toEqual(['v2']);
    expect(popup.hidden).toBe(true);
    expect(document.activeElement).toBe(button);
  });

  it('closes on Escape and on a pointer down elsewhere', () => {
    const { button, popup } = build();
    button.click();
    press(popup, 'Escape');
    expect(popup.hidden).toBe(true);
    expect(document.activeElement).toBe(button);

    button.click();
    expect(popup.hidden).toBe(false);
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(popup.hidden).toBe(true);
  });
});

describe('the seek row over a live window too narrow to seek', () => {
  function stub(edge: number | null): LiveApi {
    return { edge, latency: null, atEdge: false, seekToEdge(): void {} };
  }

  async function video(): Promise<HTMLVideoElement> {
    const node = document.createElement('video');
    node.muted = true;
    node.src = silence(10);
    document.body.append(node);
    await once(node, 'loadedmetadata');
    return node;
  }

  it('hides the bar and the time while the window is under liveWindow goals, and shows them past it', async () => {
    const media = await video();
    const flags: Record<string, boolean> = {};
    const seek = seekBar(
      media,
      (name, on) => {
        flags[name] = on;
      },
      DEFAULTS,
    );
    document.body.append(seek.root);
    const bar = seek.root.querySelector('[part~="seek"]') as HTMLElement;
    const current = seek.root.querySelector('[part~="current-time"]') as HTMLElement;
    const duration = seek.root.querySelector('[part~="duration"]') as HTMLElement;

    // Ten seconds over a 30 s goal: a third of one goal, nowhere to go.
    seek.attach({ live: stub(8), bufferGoal: () => 30 });
    expect(flags.seekable).toBe(false);
    expect(bar.hidden).toBe(true);
    expect(current.hidden).toBe(true);
    expect(duration.hidden).toBe(true);

    // Ten seconds over a 3 s goal: more than three goals.
    seek.attach({ live: stub(8), bufferGoal: () => 3 });
    expect(flags.seekable).toBe(true);
    expect(bar.hidden).toBe(false);
    expect(current.hidden).toBe(false);
    expect(current.textContent).toBe('-0:10');
    expect(duration.hidden).toBe(true);

    // A session that reports no goal is assumed to hold thirty seconds.
    seek.attach({ live: stub(8) });
    expect(flags.seekable).toBe(false);

    // VOD is always seekable.
    seek.detach();
    expect(flags.seekable).toBe(true);
    expect(duration.hidden).toBe(false);
    seek.dispose();
  });

  it('reads the wall clock from pdt for the time and the preview, when the session has it', async () => {
    const media = await video();
    const seek = seekBar(media, () => undefined, DEFAULTS);
    seek.root.style.width = '600px';
    document.body.append(seek.root);
    const pdt = {
      toWallClock: (time: number) => 1_700_000_000 + time,
      toPresentationTime: (wall: number) => wall - 1_700_000_000,
    };
    seek.attach({ live: stub(8), bufferGoal: () => 2, pdt });
    const current = seek.root.querySelector('[part~="current-time"]') as HTMLElement;
    const slider = seek.root.querySelector('[part~="seek"]') as HTMLElement;
    const rail = seek.root.querySelector('[part~="seek-rail"]') as HTMLElement;
    expect(current.textContent).toBe(clock(1_700_000_000));
    expect(slider.getAttribute('aria-valuetext')).toBe(`${clock(1_700_000_000)}, 0:10 behind live`);

    const rect = rail.getBoundingClientRect();
    slider.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + rect.width * 0.5,
        clientY: rect.top + rect.height / 2,
      }),
    );
    const preview = seek.root.querySelector('[part~="preview-time"]') as HTMLElement;
    expect(preview.textContent).toBe(clock(1_700_000_005));

    // Without an anchor the distance behind the edge is what there is.
    seek.attach({ live: stub(8), bufferGoal: () => 2, pdt: { ...pdt, toWallClock: () => null } });
    expect(current.textContent).toBe('-0:10');
    seek.dispose();
  });

  it('takes the window from the engine over the browser, which grows with the buffer', async () => {
    const media = await video();
    const flags: Record<string, boolean> = {};
    const seek = seekBar(
      media,
      (name, on) => {
        flags[name] = on;
      },
      DEFAULTS,
    );
    document.body.append(seek.root);
    // The browser's range spans the whole ten seconds; the engine's window is two.
    seek.attach({ live: stub(2), bufferGoal: () => 1, window: () => ({ start: 0, end: 2 }) });
    expect(flags.seekable).toBe(false);
    // Grown to six: two goals over, and the bar maps the engine's window, not the browser's.
    seek.attach({ live: stub(6), bufferGoal: () => 1, window: () => ({ start: 0, end: 6 }) });
    expect(flags.seekable).toBe(true);
    const slider = seek.root.querySelector('[part~="seek"]');
    expect(slider?.getAttribute('aria-valuemax')).toBe('6');
    seek.dispose();
  });

  it('seeks every live stream at liveWindow zero', async () => {
    const media = await video();
    const seek = seekBar(media, () => undefined, { ...DEFAULTS, liveWindow: 0 });
    document.body.append(seek.root);
    seek.attach({ live: stub(8), bufferGoal: () => 300 });
    expect((seek.root.querySelector('[part~="seek"]') as HTMLElement).hidden).toBe(false);
    seek.dispose();
  });
});

describe('the knobs', () => {
  it('draws the skip buttons for the default amount, and moves the playhead by it', async () => {
    const player = await ready(30);
    const back = part(player, 'skip-back-button');
    const forward = part(player, 'skip-forward-button');
    expect(shown(back)).toBe('seek-backward-10-icon');
    expect(shown(forward)).toBe('seek-forward-10-icon');
    expect(forward?.getAttribute('aria-label')).toBe('Forward 10 seconds');
    forward?.click();
    await once(player.video, 'seeked');
    expect(player.video.currentTime).toBeCloseTo(10, 1);
    back?.click();
    await once(player.video, 'seeked');
    expect(player.video.currentTime).toBeCloseTo(0, 1);
  });

  it('reads each skip amount from its attribute, with a plain arrow for an amount the set has no glyph for', () => {
    const player = mount({ controls: 'custom', 'skip-forward': '30', 'skip-back': '7' });
    expect(shown(part(player, 'skip-forward-button'))).toBe('seek-forward-30-icon');
    expect(shown(part(player, 'skip-back-button'))).toBe('seek-backward-icon');
    expect(part(player, 'skip-back-button')?.getAttribute('aria-label')).toBe('Back 7 seconds');
    expect(part(player, 'skip-forward-button')?.getAttribute('aria-label')).toBe(
      'Forward 30 seconds',
    );
  });

  it('leaves a skip button out at zero, each on its own', () => {
    const player = mount({ controls: 'custom', 'skip-back': '0' });
    expect(part(player, 'skip-back-button')).toBeNull();
    expect(part(player, 'skip-forward-button')).not.toBeNull();
  });

  it('takes the seek step and the idle delay from their attributes', async () => {
    const player = mount({
      controls: 'custom',
      src: silence(30),
      muted: '',
      'seek-step': '2',
      'idle-ms': '500',
    });
    await once(player.video, 'loadedmetadata');
    press(part(player, 'seek') as EventTarget, 'ArrowRight');
    await once(player.video, 'seeked');
    expect(player.video.currentTime).toBeCloseTo(2, 1);

    player.video.loop = true;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await player.video.play();
    vi.advanceTimersByTime(500);
    expect(idle(player)).toBe(true);
  });

  it('takes the knobs from define() under the attributes', () => {
    const player = new MatteboxPlayerElement({
      handlers: [nativeHandler()],
      controls: { skipForward: 30 },
    });
    player.setAttribute('controls', 'custom');
    document.body.append(player);
    expect(shown(part(player, 'skip-forward-button'))).toBe('seek-forward-30-icon');
    player.setAttribute('skip-forward', '10');
    expect(shown(part(player, 'skip-forward-button'))).toBe('seek-forward-10-icon');
  });
});

describe('the shortcuts', () => {
  function key(target: EventTarget, name: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key: name,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  }

  it('gives the element a tabindex under custom controls, and takes it back', () => {
    const player = mount({ controls: 'custom' });
    expect(player.getAttribute('tabindex')).toBe('0');
    player.removeAttribute('controls');
    expect(player.hasAttribute('tabindex')).toBe(false);
    const own = mount({ tabindex: '-1', controls: 'custom' });
    expect(own.getAttribute('tabindex')).toBe('-1');
  });

  it('toggles play with k and Space, mutes with m, from anywhere inside', async () => {
    const player = await ready(10);
    player.video.loop = true;
    key(player, 'k');
    await once(player.video, 'play');
    expect(player.video.paused).toBe(false);
    key(player, ' ');
    await once(player.video, 'pause');
    expect(player.video.paused).toBe(true);
    const mute = part(player, 'mute-button') as HTMLElement;
    key(mute, 'm');
    await once(player.video, 'volumechange');
    expect(player.video.muted).toBe(false);
  });

  it('leaves Space to a focused button', async () => {
    const player = await ready(10);
    const play = part(player, 'play-button') as HTMLElement;
    const event = key(play, ' ');
    expect(event.defaultPrevented).toBe(false);
    expect(player.video.paused).toBe(true);
  });

  it('seeks by the step with the arrows, once even from the seek bar', async () => {
    const player = await ready(30);
    key(part(player, 'mute-button') as EventTarget, 'ArrowRight');
    await once(player.video, 'seeked');
    expect(player.video.currentTime).toBeCloseTo(5, 1);
    key(part(player, 'seek') as EventTarget, 'ArrowRight');
    await once(player.video, 'seeked');
    expect(player.video.currentTime).toBeCloseTo(10, 1);
    key(player, 'ArrowLeft');
    await once(player.video, 'seeked');
    expect(player.video.currentTime).toBeCloseTo(5, 1);
  });

  it('ignores keys with a modifier, and keys pressed outside the element', async () => {
    const player = await ready(10);
    player.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(player.video.paused).toBe(true);
  });

  it('toggles play on a click on the video, and not on a click on the bar', async () => {
    const player = await ready(10);
    player.video.loop = true;
    player.video.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await once(player.video, 'play');
    expect(player.video.paused).toBe(false);
    (part(player, 'seek-row') as HTMLElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(player.video.paused).toBe(false);
  });
});

describe('the DRM badge', () => {
  /** An engine with a DRM namespace and nothing else the badge reads. */
  function engine(keySystem: string | null, sessions: Array<{ keyId: string; status: string }>) {
    const listeners: Array<() => void> = [];
    const fake = {
      drm: { keySystem, sessions, setLicenseUrl(): void {} },
      on(_name: string, fn: () => void): () => void {
        listeners.push(fn);
        return () => undefined;
      },
    };
    return {
      fake: fake as unknown as Mattebox,
      fire(): void {
        for (const fn of listeners) fn();
      },
    };
  }

  it('is hidden without a key system, and named and described with one', () => {
    const { fake, fire } = engine(null, []);
    const badge = drmBadge({ engine: fake, host: document.body });
    document.body.append(badge.root);
    expect(badge.root.hidden).toBe(true);

    (fake as unknown as { drm: { keySystem: string | null } }).drm.keySystem = 'com.widevine.alpha';
    fire();
    expect(badge.root.hidden).toBe(false);
    expect(badge.root.getAttribute('aria-label')).toBe('Protected by Widevine, no key yet');
    badge.dispose();
  });

  it('shows the key system and the key statuses in a tooltip on hover and on focus', () => {
    const { fake } = engine('com.microsoft.playready', [
      { keyId: 'a', status: 'usable' },
      { keyId: 'b', status: 'usable' },
      { keyId: 'c', status: 'expired' },
    ]);
    const badge = drmBadge({ engine: fake, host: document.body });
    document.body.append(badge.root);
    const tooltip = badge.root.querySelector('[part~="tooltip"]') as HTMLElement;
    expect(tooltip.hidden).toBe(true);
    expect(tooltip.textContent).toContain('PlayReady');
    expect(tooltip.textContent).toContain('com.microsoft.playready');
    expect(tooltip.textContent).toContain('3 keys: usable ×2, expired');

    badge.root.dispatchEvent(new PointerEvent('pointerenter'));
    expect(tooltip.hidden).toBe(false);
    badge.root.dispatchEvent(new PointerEvent('pointerleave'));
    expect(tooltip.hidden).toBe(true);
    (badge.root as HTMLElement).focus();
    expect(tooltip.hidden).toBe(false);
    (badge.root as HTMLElement).blur();
    expect(tooltip.hidden).toBe(true);
    badge.dispose();
  });
});

describe('the fullscreen button over a stubbed API', () => {
  it('swaps its glyph and name with the state, and reports it as a flag', () => {
    let active = false;
    let change: (() => void) | null = null;
    const flags: Record<string, boolean> = {};
    const button = fullscreenButton(
      {
        supported: true,
        active: () => active,
        toggle(): void {
          active = !active;
          change?.();
        },
        watch(fn: () => void): () => void {
          change = fn;
          return () => undefined;
        },
      },
      (name, on) => {
        flags[name] = on;
      },
    );
    document.body.append(button.root);
    expect(button.root.getAttribute('aria-label')).toBe('Enter fullscreen');
    expect(flags.fullscreen).toBe(false);
    button.root.click();
    expect(button.root.getAttribute('aria-label')).toBe('Exit fullscreen');
    expect(shown(button.root)).toBe('fullscreen-exit-icon');
    expect(flags.fullscreen).toBe(true);
    button.dispose();
  });
});

describe('a menu of several groups', () => {
  it('heads each group, walks every item with the arrows, and chooses per group', () => {
    const chosen: string[] = [];
    const control = menu({ name: 'text', label: 'Subtitles', icon: 'closed-captions' });
    control.fill([
      {
        name: 'track',
        label: 'Track',
        items: [
          ['off', 'Off'],
          ['en', 'English'],
        ],
        value: 'en',
        onSelect(value: string): void {
          chosen.push(`track:${value}`);
        },
      },
      {
        name: 'size',
        label: 'Size',
        items: [
          ['small', 'Small'],
          ['medium', 'Medium'],
        ],
        value: 'medium',
        onSelect(value: string): void {
          chosen.push(`size:${value}`);
        },
      },
    ]);
    document.body.append(control.root);
    const popup = control.root.querySelector('[role="menu"]') as HTMLElement;
    const labels = [...popup.querySelectorAll('[part~="section-label"]')].map((n) => n.textContent);
    expect(labels).toEqual(['Track', 'Size']);
    const items = [...popup.querySelectorAll('button')];
    expect(items.map((item) => item.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
      'true',
    ]);
    // One tab stop: the first checked item.
    expect(items.map((item) => item.tabIndex)).toEqual([-1, 0, -1, -1]);

    // Opens on the checked English; one step down crosses into the next group.
    (control.root.querySelector('button') as HTMLButtonElement).click();
    expect(document.activeElement).toBe(items[1]);
    press(popup, 'ArrowDown');
    expect(document.activeElement).toBe(items[2]);
    (document.activeElement as HTMLButtonElement).click();
    expect(chosen).toEqual(['size:small']);
    control.dispose();
  });
});

describe('the subtitles menu over a stubbed session', () => {
  function stubbed(host: HTMLElement) {
    const engine = {
      tracks: {
        available: [
          { id: 't-en', contentType: 'text', lang: 'en', mimeType: 'text/vtt', drm: null },
        ],
        active: () => null,
        select(): void {},
        deselect(): void {},
      },
      on: () => () => undefined,
    };
    return textMenu({ engine: engine as unknown as Mattebox, host });
  }

  it('reflects the size and the background as attributes on the host', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const control = stubbed(host);
    host.append(control.root);
    const popup = control.root.querySelector('[role="menu"]') as HTMLElement;
    const item = (group: string, value: string) =>
      [...popup.querySelectorAll<HTMLButtonElement>(`[part~="text-${group}-item"]`)].find(
        (node) => node.value === value,
      );
    // The looks sit on the Settings page behind the tracks.
    expect(item('size', 'medium')).toBeUndefined();
    (popup.querySelector('[part~="text-settings-item"]') as HTMLButtonElement).click();
    expect(item('size', 'medium')?.getAttribute('aria-checked')).toBe('true');
    expect(item('background', 'dark')?.getAttribute('aria-checked')).toBe('true');

    item('size', 'large')?.click();
    expect(host.getAttribute('subtitle-size')).toBe('large');
    // A choice closes the menu back at its first page; the page shows the choice.
    (popup.querySelector('[part~="text-settings-item"]') as HTMLButtonElement).click();
    expect(item('size', 'large')?.getAttribute('aria-checked')).toBe('true');
    item('background', 'none')?.click();
    expect(host.getAttribute('subtitle-background')).toBe('none');
    control.dispose();
  });

  it('reads a size the page set in markup', () => {
    const host = document.createElement('div');
    host.setAttribute('subtitle-size', 'xlarge');
    document.body.append(host);
    const control = stubbed(host);
    (control.root.querySelector('[part~="text-settings-item"]') as HTMLButtonElement).click();
    const checked = [
      ...control.root.querySelectorAll<HTMLButtonElement>('[part~="text-size-item"]'),
    ].find((node) => node.getAttribute('aria-checked') === 'true');
    expect(checked?.value).toBe('xlarge');
    control.dispose();
  });
});

describe('the speed menu', () => {
  it("offers the rates, marks the video's own, and writes a choice back", async () => {
    const player = await ready(10);
    const popup = part(player, 'speed-popup') as HTMLElement;
    const items = [...popup.querySelectorAll<HTMLButtonElement>('button')];
    expect(items.map((item) => item.textContent)).toEqual([
      '0.5×',
      '0.75×',
      'Normal',
      '1.25×',
      '1.5×',
      '2×',
    ]);
    expect(items.find((item) => item.getAttribute('aria-checked') === 'true')?.value).toBe('1');
    items.find((item) => item.value === '1.5')?.click();
    await once(player.video, 'ratechange');
    expect(player.video.playbackRate).toBe(1.5);
    const checked = [...popup.querySelectorAll<HTMLButtonElement>('button')].find(
      (item) => item.getAttribute('aria-checked') === 'true',
    );
    expect(checked?.value).toBe('1.5');
  });
});

describe('the subtitles and the bar', () => {
  it('puts the cue rules in the document once, one per look the attributes can take', () => {
    mount({ controls: 'custom' });
    const styles = document.head.querySelectorAll('style[data-mattebox-cue]');
    expect(styles.length).toBe(1);
    const text = styles[0]?.textContent ?? '';
    expect(text).toContain('mattebox-player[subtitle-size="large"] > video::cue');
    // The background goes on the cue and on the backdrop Chromium and WebKit paint, both.
    expect(text).toContain(
      'mattebox-player[subtitle-background="none"] > video::-webkit-media-text-track-display-backdrop',
    );
    expect(text).toContain('mattebox-player[subtitle-background="none"] > video::cue');
    expect(text).not.toContain('@supports');
    // Percentages of the browser's own cue size, which follows the video's height.
    expect(text).toMatch(/subtitle-size="large"[^}]*font-size: 150%/);
    expect(text).not.toContain('var(');
    mount({ controls: 'custom' });
    expect(document.head.querySelectorAll('style[data-mattebox-cue]').length).toBe(1);
  });

  it('lifts an unpositioned active cue above the bar while it shows, and puts it back', async () => {
    // A bare video and a stand-in bar, so no other lift holds the cues.
    const video = document.createElement('video');
    video.muted = true;
    video.src = silence(10);
    document.body.append(video);
    await once(video, 'loadedmetadata');
    const fakeBar = document.createElement('div');
    fakeBar.style.height = '80px';
    document.body.append(fakeBar);
    const track = video.addTextTrack('subtitles', 'Test', 'en');
    track.mode = 'showing';
    const cue = new VTTCue(0, 10, 'Hello');
    const second = new VTTCue(0, 10, 'Second, two\nlines');
    const placed = new VTTCue(0, 10, 'Author placed');
    placed.line = 10;
    track.addCue(cue);
    track.addCue(second);
    track.addCue(placed);
    // Cues become active when time marches, which a seek makes it do.
    video.currentTime = 1;
    await once(video, 'seeked');
    await expect.poll(() => track.activeCues?.length ?? 0).toBe(3);

    const host = document.createElement('div');
    const lift = cueLift(video, fakeBar, host);
    lift.lifted(true);
    // A negative line count, which wraps everywhere; the earliest sits
    // lowest and the next climbs past it, whichever end a browser anchors.
    expect(cue.snapToLines).toBe(true);
    expect(typeof cue.line).toBe('number');
    const first = cue.line as number;
    expect(first).toBeLessThan(-1);
    // The second is two lines tall: it climbs by at least that.
    expect(second.line as number).toBeLessThanOrEqual(first - 2);
    expect(placed.line).toBe(10);

    // At another size the stack holds.
    host.setAttribute('subtitle-size', 'xlarge');
    lift.lifted(true);
    expect(second.line as number).toBeLessThan(cue.line as number);

    lift.lifted(false);
    expect(cue.line).toBe('auto');
    expect(cue.snapToLines).toBe(true);
    expect(second.line).toBe('auto');
    lift.dispose();
  });
});

describe('the picture-in-picture button', () => {
  it('shows exactly when an API exists, and swaps its glyph and name with the state', () => {
    const player = mount({ controls: 'custom' });
    const host: object = player.video;
    const supported =
      ('requestPictureInPicture' in host && document.pictureInPictureEnabled) ||
      'webkitSetPresentationMode' in host;
    expect(part(player, 'pip-button')?.hidden).toBe(!supported);

    let active = false;
    let change: (() => void) | null = null;
    const flags: Record<string, boolean> = {};
    const button = pipButton(
      {
        supported: true,
        active: () => active,
        toggle(): void {
          active = !active;
          change?.();
        },
        watch(fn: () => void): () => void {
          change = fn;
          return () => undefined;
        },
      },
      (name, on) => {
        flags[name] = on;
      },
    );
    document.body.append(button.root);
    expect(button.root.getAttribute('aria-label')).toBe('Picture in picture');
    expect(shown(button.root)).toBe('picture-in-picture-icon');
    button.root.click();
    expect(button.root.getAttribute('aria-label')).toBe('Leave picture in picture');
    expect(shown(button.root)).toBe('picture-in-picture-exit-icon');
    expect(flags.pip).toBe(true);
    button.dispose();
  });
});

describe('the layout knob', () => {
  /** Each child's specific part name, the last one it carries. */
  const names = (row: Element | null) =>
    [...(row?.querySelectorAll(':scope > [part]') ?? [])].map(
      (node) => node.getAttribute('part')?.split(' ').pop() ?? '',
    );

  it('carries every control in the default order', () => {
    const player = mount({ controls: 'custom' });
    const row = part(player, 'buttons');
    expect(names(row)).toEqual([
      'skip-back-button',
      'play-button',
      'skip-forward-button',
      'volume-group',
      'cluster',
    ]);
    expect(names(part(player, 'cluster'))).toEqual([
      'speed-menu',
      'subtitles-slot',
      'audio-slot',
      'quality-slot',
      'pip-button',
      'fullscreen-button',
    ]);
    // The lock is a control the row can carry, and does not by default.
    expect(part(player, 'drm-slot')).toBeNull();
    const withLock = mount({ controls: 'custom', layout: 'play | drm' });
    expect(part(withLock, 'drm-slot')).not.toBeNull();
  });

  it('builds only what the attribute names, in its order, either side of the bar', () => {
    const player = mount({ controls: 'custom', layout: 'fullscreen play | volume nonsense' });
    expect(names(part(player, 'buttons'))).toEqual(['fullscreen-button', 'play-button', 'cluster']);
    expect(names(part(player, 'cluster'))).toEqual(['volume-group']);
    expect(part(player, 'skip-back-button')).toBeNull();
    expect(part(player, 'speed-menu')).toBeNull();
  });

  it('rebuilds when the attribute changes, and takes the option under it', () => {
    const player = new MatteboxPlayerElement({
      handlers: [nativeHandler()],
      controls: { layout: 'play' },
    });
    player.setAttribute('controls', 'custom');
    document.body.append(player);
    expect(names(part(player, 'buttons'))).toEqual(['play-button', 'cluster']);
    player.setAttribute('layout', 'play | fullscreen');
    expect(names(part(player, 'cluster'))).toEqual(['fullscreen-button']);
  });
});

describe('the screens over the picture', () => {
  it('shows a large play while paused, a replay once ended, and nothing while playing', async () => {
    const player = await ready(10);
    const start = part(player, 'start-button') as HTMLButtonElement;
    expect(start.parentElement?.getAttribute('part')).toBe('stage');
    expect(start.hidden).toBe(false);
    expect(start.getAttribute('aria-label')).toBe('Play');
    expect(bar(player)?.getAttribute('part')?.split(' ')).toContain('paused');

    start.click();
    await once(player.video, 'play');
    expect(start.hidden).toBe(true);
    player.video.pause();
    await once(player.video, 'pause');
    expect(start.hidden).toBe(false);

    player.video.currentTime = 10;
    await player.video.play();
    await once(player.video, 'ended');
    expect(start.hidden).toBe(false);
    expect(start.getAttribute('aria-label')).toBe('Replay');
    expect(shown(start)).toBe('replay-icon');
  });

  it('shows a fatal error over the picture, not in the row under it, and clears on the next load', async () => {
    const player = mount({
      controls: 'custom',
      src: 'https://cdn.test/a.m3u8',
      type: 'application/x-nonsense',
    });
    const screen = part(player, 'error-screen') as HTMLElement;
    await expect.poll(() => screen.hidden).toBe(false);
    expect(screen.parentElement?.getAttribute('part')).toBe('stage');
    expect(part(player, 'error-code')?.textContent).toBe('MANIFEST_UNSUPPORTED');
    expect(part(player, 'error-category')?.textContent).toBe('manifest');
    expect(part(player, 'start-button')?.hidden).toBe(true);
    // The row under the video is the native mode's, and stays quiet.
    expect(part(player, 'error')?.hidden).toBe(true);

    let loads = 0;
    player.addEventListener('sourcechange', () => {
      loads += 1;
    });
    player.setAttribute('type', 'audio/wav');
    player.setAttribute('src', silence());
    await expect.poll(() => loads).toBe(1);
    expect(screen.hidden).toBe(true);
  });
});

describe('the error screen across loads, the way the demo drives the element', () => {
  it('clears when a source that plays follows one that failed, and shows again for one that fails', async () => {
    const player = mount({
      controls: 'custom',
      src: 'https://cdn.test/a.m3u8',
      type: 'application/x-nonsense',
    });
    const screen = part(player, 'error-screen') as HTMLElement;
    await expect.poll(() => screen.hidden).toBe(false);

    // The demo clears the source, sets what describes the next one, sets it,
    // then re-applies the bar's attributes at their current values.
    let loads = 0;
    player.addEventListener('sourcechange', () => {
      loads += 1;
    });
    player.removeAttribute('src');
    player.setAttribute('type', 'audio/wav');
    player.setAttribute('src', silence());
    player.setAttribute('controls', 'custom');
    player.setAttribute('layout', 'play | fullscreen');
    await expect.poll(() => loads).toBe(1);
    expect((part(player, 'error-screen') as HTMLElement).hidden).toBe(true);

    player.removeAttribute('src');
    player.setAttribute('type', 'application/x-nonsense');
    player.setAttribute('src', 'https://cdn.test/b.m3u8');
    await expect.poll(() => (part(player, 'error-screen') as HTMLElement).hidden).toBe(false);
    expect(part(player, 'error-code')?.textContent).toBe('MANIFEST_UNSUPPORTED');
  });
});

describe('the start knob', () => {
  it('leaves the large play out at zero, through every state', async () => {
    const player = mount({ controls: 'custom', src: silence(10), muted: '', start: '0' });
    await once(player.video, 'loadedmetadata');
    const start = part(player, 'start-button') as HTMLElement;
    expect(start.hidden).toBe(true);
    await player.video.play();
    player.video.pause();
    await once(player.video, 'pause');
    expect(start.hidden).toBe(true);
  });
});

describe('a menu with a page behind an entry', () => {
  function build() {
    const chosen: string[] = [];
    const control = menu({ name: 'text', label: 'Subtitles', icon: 'closed-captions' });
    control.fill([
      {
        name: 'track',
        items: [
          ['off', 'Off'],
          ['en', 'English'],
        ],
        value: 'off',
        onSelect(value: string): void {
          chosen.push(`track:${value}`);
        },
      },
      {
        name: 'settings',
        label: 'Settings',
        entries: [
          {
            name: 'size',
            label: 'Size',
            items: [
              ['small', 'Small'],
              ['large', 'Large'],
            ],
            value: 'small',
            onSelect(value: string): void {
              chosen.push(`size:${value}`);
            },
          },
        ],
      },
    ]);
    document.body.append(control.root);
    const button = control.root.querySelector('button') as HTMLButtonElement;
    const popup = control.root.querySelector('[role="menu"]') as HTMLElement;
    return { control, button, popup, chosen };
  }

  it('opens the page from its entry, walks it, goes back on Escape, and closes on a choice', () => {
    const { button, popup, chosen } = build();
    button.click();
    const link = popup.querySelector('[part~="text-settings-item"]') as HTMLButtonElement;
    expect(link.getAttribute('aria-haspopup')).toBe('menu');
    expect(popup.querySelector('[part~="back-item"]')).toBeNull();

    link.click();
    const back = popup.querySelector('[part~="back-item"]') as HTMLButtonElement;
    expect(back.textContent).toBe('Settings');
    expect(document.activeElement).toBe(back);
    expect(popup.querySelectorAll('[part~="text-size-item"]').length).toBe(2);
    expect(popup.querySelector('[part~="text-track-item"]')).toBeNull();

    press(popup, 'Escape');
    expect(popup.hidden).toBe(false);
    expect(popup.querySelector('[part~="back-item"]')).toBeNull();
    expect(popup.querySelector('[part~="text-track-item"]')).not.toBeNull();

    link.isConnected
      ? link.click()
      : (popup.querySelector('[part~="text-settings-item"]') as HTMLButtonElement).click();
    (popup.querySelector('[part~="text-size-item"][value="large"]') as HTMLButtonElement).click();
    expect(chosen).toEqual(['size:large']);
    expect(popup.hidden).toBe(true);
    button.click();
    expect(popup.querySelector('[part~="text-track-item"]')).not.toBeNull();
  });

  it('never leaves the stage: the popup takes the room above the button as its height', async () => {
    const player = await ready(10);
    (part(player, 'speed-button') as HTMLButtonElement).click();
    const popup = part(player, 'speed-popup') as HTMLElement;
    const height = Number.parseFloat(popup.style.maxHeight);
    expect(height).toBeGreaterThan(0);
    const stage = part(player, 'stage') as HTMLElement;
    expect(height).toBeLessThan(stage.getBoundingClientRect().height);
    expect(getComputedStyle(popup).overflowY).toBe('auto');
  });
});

describe('the error screen against a picture that plays', () => {
  it('clears once playback resumes, whatever the engine said', async () => {
    const player = mount({
      controls: 'custom',
      src: 'https://cdn.test/a.m3u8',
      type: 'application/x-nonsense',
    });
    const screen = part(player, 'error-screen') as HTMLElement;
    await expect.poll(() => screen.hidden).toBe(false);
    player.video.dispatchEvent(new Event('playing'));
    expect(screen.hidden).toBe(true);
  });
});

describe('the lift and Chromium', () => {
  it('rebuilds the track display through its mode when a line changes, and leaves it showing', async () => {
    const video = document.createElement('video');
    video.muted = true;
    video.src = silence(10);
    document.body.append(video);
    await once(video, 'loadedmetadata');
    const fakeBar = document.createElement('div');
    fakeBar.style.height = '80px';
    document.body.append(fakeBar);
    const track = video.addTextTrack('subtitles', 'Test', 'en');
    track.mode = 'showing';
    const cue = new VTTCue(0, 10, 'Hello');
    track.addCue(cue);
    video.currentTime = 1;
    await once(video, 'seeked');
    await expect.poll(() => track.activeCues?.length ?? 0).toBe(1);
    const modes: string[] = [];
    const seen = () => modes.push(track.mode);
    video.textTracks.addEventListener('change', seen);
    const lift = cueLift(video, fakeBar, document.createElement('div'));
    lift.lifted(true);
    expect(track.mode).toBe('showing');
    expect(typeof cue.line).toBe('number');
    // The change event lands later, finds the same lines, and flips nothing more.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const flips = modes.length;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(modes.length).toBe(flips);
    expect(track.mode).toBe('showing');
    video.textTracks.removeEventListener('change', seen);
    lift.dispose();
  });
});
