/**
 * The player's live region, over a deterministic video: what it says for a
 * play, a pause, a long wait, a fatal error and a track change, and what
 * it keeps quiet about.
 */
import { MatteboxPlayerElement } from '@mattebox/player';
import { nativeHandler } from '@mattebox/player-core';
import { afterEach, describe, expect, it } from 'vitest';
import { fakeMedia, media } from './helpers.js';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Past the region's refill delay. */
const SPOKEN_MS = 150;

async function mount(
  attributes: Readonly<Record<string, string>> = {},
): Promise<MatteboxPlayerElement> {
  const player = new MatteboxPlayerElement({ handlers: [nativeHandler()] });
  fakeMedia(player.video);
  player.setAttribute('controls', 'custom');
  player.setAttribute('src', 'https://cdn.test/source');
  for (const [name, value] of Object.entries(attributes)) player.setAttribute(name, value);
  document.body.append(player);
  await wait(0);
  await media(player.video).metadata(10);
  return player;
}

function region(player: MatteboxPlayerElement): HTMLElement {
  const found = player.shadowRoot?.querySelector<HTMLElement>('[part~="announcer"]');
  if (found == null) throw new Error('no live region');
  return found;
}

async function spoken(player: MatteboxPlayerElement): Promise<string> {
  await wait(SPOKEN_MS);
  return region(player).textContent ?? '';
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('the live region', () => {
  it('is a polite status region, hidden from sight', async () => {
    const player = await mount();
    const node = region(player);
    expect(node.getAttribute('role')).toBe('status');
    expect(node.getAttribute('aria-live')).toBe('polite');
    expect(node.getBoundingClientRect().width).toBeLessThanOrEqual(1);
  });

  it('says a play and a pause, and not the pause at the end', async () => {
    const player = await mount();
    await player.video.play();
    expect(await spoken(player)).toBe('Playing');
    player.video.pause();
    expect(await spoken(player)).toBe('Paused');
    await player.video.play();
    await media(player.video).end();
    expect(await spoken(player)).toBe('Playing');
  });

  it('says the same phrase again by emptying the region first', async () => {
    const player = await mount();
    await player.video.play();
    player.video.pause();
    expect(await spoken(player)).toBe('Paused');
    await player.video.play();
    player.video.pause();
    expect(region(player).textContent).toBe('');
    expect(await spoken(player)).toBe('Paused');
  });

  it('says a wait once it lasts a second, and nothing for a short one', async () => {
    const player = await mount();
    await player.video.play();
    await spoken(player);
    player.video.dispatchEvent(new Event('waiting'));
    await wait(300);
    player.video.dispatchEvent(new Event('canplay'));
    await wait(1000);
    expect(region(player).textContent).toBe('Playing');
    player.video.dispatchEvent(new Event('waiting'));
    await wait(1000);
    expect(await spoken(player)).toBe('Loading');
  });

  it('says a fatal error, unless an error screen in the player says it', async () => {
    const fatal = { category: 'network', code: 'NETWORK_ERROR', fatal: true, recoverable: true };
    const player = await mount();
    // The element's own report path: the core's error, as a handler gives it.
    (player as unknown as { report(error: unknown): void }).report(fatal);
    expect(await spoken(player)).toBe('Playback failed');

    const screened = await mount();
    screened.append(document.createElement('mbx-error-screen'));
    (screened as unknown as { report(error: unknown): void }).report(fatal);
    expect(await spoken(screened)).toBe('');
  });

  it('says a subtitle change after the first play, and not the tracks a load starts with', async () => {
    const player = await mount();
    const track = player.video.addTextTrack('subtitles', 'English', 'en');
    track.mode = 'showing';
    await wait(0);
    expect(await spoken(player)).toBe('');
    await player.video.play();
    track.mode = 'disabled';
    expect(await spoken(player)).toBe('Subtitles off');
    track.mode = 'showing';
    expect(await spoken(player)).toBe('Subtitles: English');
  });

  it('reads its phrases from the label attributes', async () => {
    const player = await mount({
      'label-playing': 'Lecture',
      'label-subtitles': 'Sous-titres : {track}',
    });
    const track = player.video.addTextTrack('captions', '', 'fr');
    await player.video.play();
    expect(await spoken(player)).toBe('Lecture');
    track.mode = 'showing';
    expect(await spoken(player)).toMatch(/^Sous-titres : (French|fr)$/);
  });

  it('keeps quiet under announce="off"', async () => {
    const player = await mount({ announce: 'off' });
    await player.video.play();
    player.video.pause();
    expect(await spoken(player)).toBe('');
  });
});
