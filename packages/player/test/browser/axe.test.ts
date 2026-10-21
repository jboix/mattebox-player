/**
 * axe-core over every control the player ships, in the states a viewer
 * meets: before the first play, playing, with each menu open, and after a
 * fatal error. The rules are in test/browser/axe.ts.
 */
import { MatteboxPlayerElement } from '@mattebox/player';
import { nativeHandler } from '@mattebox/player-core';
import { afterEach, describe, expect, it } from 'vitest';
import { violations } from '../../../../test/browser/axe.js';
import { compose, fakeMedia, media } from './helpers.js';

const MENUS = [
  'mbx-speed-menu',
  'mbx-chapters-menu',
  'mbx-subtitles-menu',
  'mbx-audio-menu',
  'mbx-quality-menu',
];

function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** The player under custom controls with every control in, and the metadata of a 10 s clip. */
async function mount(): Promise<MatteboxPlayerElement> {
  const player = new MatteboxPlayerElement({ handlers: [nativeHandler()] });
  fakeMedia(player.video);
  player.setAttribute('controls', 'custom');
  player.setAttribute('layout', 'regular');
  player.setAttribute('src', 'https://cdn.test/source');
  player.append(...compose());
  player.style.width = '800px';
  document.body.append(player);
  await settled();
  await media(player.video).metadata(10);
  return player;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('axe-core', () => {
  it("reaches into the controls' shadow roots", async () => {
    const player = await mount();
    const host = document.createElement('div');
    host.attachShadow({ mode: 'open' }).append(document.createElement('button'));
    player.append(host);
    expect((await violations(player)).some((line) => line.startsWith('button-name'))).toBe(true);
  });

  it('finds nothing before the first play', async () => {
    const player = await mount();
    expect(await violations(player)).toEqual([]);
  });

  it('finds nothing while the video plays', async () => {
    const player = await mount();
    await player.video.play();
    expect(await violations(player)).toEqual([]);
  });

  it('finds nothing in an open menu', async () => {
    const player = await mount();
    // A track for the subtitles menu, which hides without one.
    player.video.addTextTrack('subtitles', 'English', 'en');
    await settled();
    let opened = 0;
    for (const tag of MENUS) {
      const menu = player.querySelector(tag);
      const button = menu?.shadowRoot?.querySelector('button');
      if (menu === null || (menu as HTMLElement).hidden || button == null) continue;
      button.click();
      await settled();
      opened += 1;
      expect(await violations(player), tag).toEqual([]);
      button.click();
      await settled();
    }
    // Speed is always there; subtitles has its track.
    expect(opened).toBeGreaterThanOrEqual(2);
  });

  it('finds nothing on the error screen', async () => {
    const player = await mount();
    player.dispatchEvent(
      new CustomEvent('error', {
        detail: { category: 'network', code: 'NETWORK_ERROR', fatal: true, recoverable: true },
      }),
    );
    await settled();
    expect(await violations(player)).toEqual([]);
  });
});
