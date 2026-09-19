/**
 * <mbx-title> and <mbx-spinner>: the two screens over the picture that read
 * only the video's events. Over a deterministic video, so play and pause
 * move state and fire what a real video fires, and the waits are dispatched
 * as a real video would dispatch them.
 */
import { MatteboxPlayerElement } from '@mattebox/player';
import { nativeHandler } from '@mattebox/player-core';
import { afterEach, describe, expect, it } from 'vitest';
import { fakeMedia } from './helpers.js';

function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** A player under custom controls with its own bar, a title and a spinner beside the video. */
async function mount(titleAttributes: Readonly<Record<string, string>> = {}): Promise<{
  player: MatteboxPlayerElement;
  title: HTMLElement;
  spinner: HTMLElement;
}> {
  const player = new MatteboxPlayerElement({ handlers: [nativeHandler()] });
  fakeMedia(player.video);
  player.setAttribute('controls', 'custom');
  player.setAttribute('src', 'https://cdn.test/source');
  const title = document.createElement('mbx-title');
  for (const [name, value] of Object.entries(titleAttributes)) title.setAttribute(name, value);
  const spinner = document.createElement('mbx-spinner');
  const bar = document.createElement('mbx-control-bar');
  player.append(title, spinner, bar);
  document.body.append(player);
  await settled();
  return { player, title, spinner };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('<mbx-title>', () => {
  it('draws the heading, the subheading and the artwork, and nothing without them', async () => {
    const { title } = await mount();
    expect(title.hasAttribute('empty')).toBe(true);
    title.setAttribute('heading', 'The rodents');
    title.setAttribute('subheading', 'Episode 3');
    title.setAttribute('artwork', 'https://cdn.test/rodents.jpg');
    expect(title.hasAttribute('empty')).toBe(false);
    const root = title.shadowRoot;
    expect(root?.querySelector('[part~="heading"]')?.textContent).toBe('The rodents');
    expect(root?.querySelector('[part~="subheading"]')?.textContent).toBe('Episode 3');
    const artwork = root?.querySelector<HTMLImageElement>('[part~="artwork"]');
    expect(artwork?.src).toBe('https://cdn.test/rodents.jpg');
    expect(artwork?.hidden).toBe(false);
    title.removeAttribute('artwork');
    expect(artwork?.hidden).toBe(true);
  });

  it('carries playing while the video plays, and sits above the bar', async () => {
    const { player, title } = await mount({ heading: 'The rodents' });
    expect(title.hasAttribute('playing')).toBe(false);
    expect(getComputedStyle(title).display).toBe('flex');
    await player.video.play();
    expect(title.hasAttribute('playing')).toBe(true);
    expect(getComputedStyle(title).display).toBe('none');
    player.video.pause();
    await settled();
    expect(title.hasAttribute('playing')).toBe(false);
    // The height of the bar's rows, for the text to sit just above them.
    const bar = player.querySelector('mbx-control-bar') as HTMLElement;
    const rows =
      bar.getBoundingClientRect().height - Number.parseFloat(getComputedStyle(bar).paddingTop);
    expect(title.style.getPropertyValue('--mbx-bar-rows')).toBe(`${rows}px`);
  });

  it('lets the page keep it to the time before the first play', async () => {
    const { player, title } = await mount({ heading: 'The rodents' });
    const sheet = document.createElement('style');
    sheet.textContent = 'mattebox-player[started] mbx-title { display: none; }';
    document.head.append(sheet);
    try {
      expect(getComputedStyle(title).display).toBe('flex');
      await player.video.play();
      player.video.pause();
      await settled();
      expect(player.hasAttribute('started')).toBe(true);
      expect(getComputedStyle(title).display).toBe('none');
    } finally {
      sheet.remove();
    }
  });
});

describe('<mbx-spinner>', () => {
  it('shows while the video waits for data, and names itself', async () => {
    const { player, spinner } = await mount();
    const video = player.video;
    expect(spinner.getAttribute('aria-label')).toBe('Loading');
    expect(getComputedStyle(spinner).display).toBe('none');

    video.dispatchEvent(new Event('waiting'));
    expect(player.hasAttribute('waiting')).toBe(true);
    expect(spinner.hasAttribute('waiting')).toBe(true);
    expect(getComputedStyle(spinner).display).toBe('block');

    video.dispatchEvent(new Event('canplay'));
    expect(player.hasAttribute('waiting')).toBe(false);
    expect(spinner.hasAttribute('waiting')).toBe(false);

    video.dispatchEvent(new Event('stalled'));
    expect(spinner.hasAttribute('waiting')).toBe(true);
    video.dispatchEvent(new Event('playing'));
    expect(spinner.hasAttribute('waiting')).toBe(false);
  });

  it('takes the centre from the start button while the video waits', async () => {
    const { player } = await mount();
    const start = document.createElement('mbx-start-button');
    player.append(start);
    await settled();
    expect(start.hidden).toBe(false);
    player.video.dispatchEvent(new Event('waiting'));
    expect(start.hidden).toBe(true);
    player.video.dispatchEvent(new Event('canplay'));
    expect(start.hidden).toBe(false);
  });

  it('takes the words and the glyph the page gives', async () => {
    const { player, spinner } = await mount();
    spinner.setAttribute('label', 'Carregant');
    expect(spinner.getAttribute('aria-label')).toBe('Carregant');
    const glyph = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    glyph.setAttribute('slot', 'icon');
    spinner.append(glyph);
    await settled();
    expect(spinner.shadowRoot?.querySelector<HTMLElement>('[part~="ring"]')?.hidden).toBe(true);
    player.video.dispatchEvent(new Event('waiting'));
    expect(getComputedStyle(spinner).display).toBe('block');
  });
});
