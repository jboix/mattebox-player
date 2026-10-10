/**
 * The playlist in a real player: the markup loads its items, the end of one
 * plays the next, and the list follows the children. The items are short
 * WAV clips on a native session, so `ended` is the browser's own.
 */
import { MatteboxPlayerElement } from '@mattebox/player';
import { nativeHandler } from '@mattebox/player-core';
import { createPlaylist, playlistOf } from '@mattebox/player-playlist';
import { afterEach, describe, expect, it } from 'vitest';
import { once, silence } from './helpers.js';

afterEach(() => {
  document.body.replaceChildren();
});

describe('<mbx-playlist>', () => {
  it('loads its children, plays the next one at the end, and follows edits', async () => {
    const clips = [silence(0.25), silence(0.25), silence(0.25)];
    const player = new MatteboxPlayerElement({ handlers: [nativeHandler()] });
    player.setAttribute('muted', '');
    player.innerHTML = `
      <mbx-title></mbx-title>
      <mbx-playlist repeat="all">
        <mbx-playlist-item src="${clips[0]}" type="audio/wav" heading="One"></mbx-playlist-item>
        <mbx-playlist-item src="${clips[1]}" type="audio/wav" heading="Two"></mbx-playlist-item>
      </mbx-playlist>`;
    document.body.append(player);
    await expect.poll(() => player.getAttribute('src')).toBe(clips[0]);
    const playlist = playlistOf(player);
    expect(playlist?.repeat).toBe('all');
    expect(player.querySelector('mbx-title')?.getAttribute('heading')).toBe('One');

    await once(player.video, 'loadedmetadata');
    await player.video.play();
    await expect.poll(() => player.getAttribute('src'), { timeout: 4000 }).toBe(clips[1]);
    await expect.poll(() => player.video.paused, { timeout: 4000 }).toBe(false);
    expect(player.querySelector('mbx-title')?.getAttribute('heading')).toBe('Two');

    const third = document.createElement('mbx-playlist-item');
    third.setAttribute('src', clips[2] as string);
    third.setAttribute('heading', 'Three');
    player.querySelector('mbx-playlist')?.append(third);
    await expect.poll(() => playlist?.items.length).toBe(3);
    expect(playlist?.index).toBe(1);
    expect(playlist?.upcoming?.heading).toBe('Three');
  });
});

/** The real button inside a control's shadow root. */
function inner(node: Element | null): HTMLButtonElement {
  const found = node?.shadowRoot?.querySelector('button');
  if (found === null || found === undefined) throw new Error('no button inside');
  return found;
}

describe('the playlist controls', () => {
  async function mounted(): Promise<MatteboxPlayerElement> {
    const player = new MatteboxPlayerElement({ handlers: [nativeHandler()] });
    player.setAttribute('controls', 'custom');
    player.setAttribute('muted', '');
    player.style.width = '800px';
    player.style.height = '450px';
    player.innerHTML = `
      <mbx-up-next></mbx-up-next>
      <mbx-playlist label-close="Tanca" pause-on-open></mbx-playlist>
      <mbx-control-bar>
        <mbx-previous-button></mbx-previous-button>
        <mbx-play-button></mbx-play-button>
        <mbx-next-button></mbx-next-button>
        <mbx-playlist-button></mbx-playlist-button>
      </mbx-control-bar>`;
    document.body.append(player);
    await customElements.whenDefined('mattebox-player');
    createPlaylist(player).load([
      {
        src: silence(5),
        type: 'audio/wav',
        heading: 'One',
        subheading: 'S1',
        duration: 65,
        markers: [{ start: 0, end: 5, kind: 'closing-credits' }],
      },
      { src: silence(5), type: 'audio/wav', heading: 'Two' },
      { src: silence(5), type: 'audio/wav', heading: 'Three' },
    ]);
    return player;
  }

  it('show next only while there is one, and previous while the list has items', async () => {
    const player = await mounted();
    const next = player.querySelector('mbx-next-button') as HTMLElement;
    const previous = player.querySelector('mbx-previous-button') as HTMLElement;
    await expect.poll(() => next.hidden).toBe(false);
    expect(previous.hidden).toBe(false);
    expect(inner(next).getAttribute('aria-label')).toBe('Next');
    inner(next).click();
    inner(next).click();
    expect(playlistOf(player)?.index).toBe(2);
    expect(next.hidden).toBe(true);
  });

  it('open a list that a script loaded, mark the item that plays, and play the one picked', async () => {
    const player = await mounted();
    const opener = player.querySelector('mbx-playlist-button') as HTMLElement;
    const panel = player.querySelector('mbx-playlist') as HTMLElement;
    await expect.poll(() => opener.hidden).toBe(false);
    expect(getComputedStyle(panel).display).toBe('none');
    inner(opener).click();
    expect(panel.hasAttribute('open')).toBe(true);
    await expect.poll(() => inner(opener).getAttribute('aria-expanded')).toBe('true');
    const rows = [...(panel.shadowRoot?.querySelectorAll('[part~="item"]') ?? [])] as HTMLElement[];
    expect(rows.map((row) => row.querySelector('[part~="item-title"]')?.textContent)).toEqual([
      'One',
      'Two',
      'Three',
    ]);
    expect(rows[0]?.getAttribute('aria-current')).toBe('true');
    expect(rows[0]?.querySelector('[part~="item-duration"]')?.textContent).toBe('1:05');
    expect(panel.shadowRoot?.activeElement).toBe(rows[0]);
    rows[1]?.click();
    expect(playlistOf(player)?.index).toBe(1);
    expect(panel.hasAttribute('open')).toBe(false);
    expect(playlistOf(player)?.items.length).toBe(3);
  });

  it('toggle shuffle and cycle repeat from the list, with the 1 for repeat one', async () => {
    const player = await mounted();
    const panel = player.querySelector('mbx-playlist') as HTMLElement;
    await expect.poll(() => playlistOf(player)).not.toBeNull();
    const part = (name: string) =>
      panel.shadowRoot?.querySelectorAll('[part~="button"]')[
        ['close', 'shuffle', 'repeat', 'previous', 'next'].indexOf(name)
      ] as HTMLButtonElement;
    expect(part('close').getAttribute('aria-label')).toBe('Tanca');
    part('shuffle').click();
    expect(playlistOf(player)?.shuffle).toBe(true);
    await expect.poll(() => part('shuffle').getAttribute('aria-pressed')).toBe('true');
    part('repeat').click();
    part('repeat').click();
    expect(playlistOf(player)?.repeat).toBe('one');
    await expect.poll(() => part('repeat').getAttribute('aria-label')).toBe('Repeat one');
    const badge = panel.shadowRoot?.querySelector('[part~="badge"]') as HTMLElement;
    expect(badge.hidden).toBe(false);
    panel.setAttribute('open', '');
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel.hasAttribute('open')).toBe(false);
  });

  it('take the whole height for the list, pause while it is open, and play again on close', async () => {
    const player = await mounted();
    const opener = player.querySelector('mbx-playlist-button') as HTMLElement;
    const panel = player.querySelector('mbx-playlist') as HTMLElement;
    await expect.poll(() => opener.hidden).toBe(false);
    await once(player.video, 'loadedmetadata');
    await player.video.play();
    inner(opener).click();
    expect(panel.getBoundingClientRect().height).toBe(player.getBoundingClientRect().height);
    expect(player.video.paused).toBe(true);
    inner(opener).click();
    expect(panel.hasAttribute('open')).toBe(false);
    await expect.poll(() => player.video.paused).toBe(false);
  });

  it('offer the next item over the closing credits, play it, or stay on this one', async () => {
    const player = await mounted();
    const card = player.querySelector('mbx-up-next') as HTMLElement;
    await expect.poll(() => card.hidden).toBe(false);
    expect(player.hasAttribute('upnext')).toBe(true);
    const part = (name: string) =>
      card.shadowRoot?.querySelector(`[part~="${name}"]`) as HTMLElement;
    expect(part('heading').textContent).toBe('Up next');
    expect(part('title').textContent).toBe('Two');
    expect(part('button').getAttribute('aria-label')).toBe('Close');
    part('button').click();
    expect(card.hidden).toBe(true);
    expect(player.hasAttribute('upnext')).toBe(false);
    // Another item, a fresh card: the close held for the first item only.
    playlistOf(player)?.select(1);
    playlistOf(player)?.select(0);
    await expect.poll(() => card.hidden).toBe(false);
    part('play').click();
    expect(playlistOf(player)?.index).toBe(1);
    await expect.poll(() => card.hidden).toBe(true);
  });
});
