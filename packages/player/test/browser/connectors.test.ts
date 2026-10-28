import type { Connector, Programme, Tracker } from '@mattebox/player';
import { MatteboxPlayerElement } from '@mattebox/player';
import type { Handler } from '@mattebox/player-core';
import { afterEach, describe, expect, it } from 'vitest';
import { compose, fakeMedia } from './helpers.js';

/** Takes every source and plays nothing: the tests read what the element did around it. */
const stub: Handler = {
  name: 'stub',
  canHandle: () => 'maybe',
  handle: async () => ({ handler: 'stub', engine: null, dispose: async () => undefined }),
};

interface Show {
  readonly title: string;
  readonly url?: string;
  readonly blocked?: string;
}

const SHOWS: Readonly<Record<string, Show>> = {
  'show:1': { title: 'First', url: 'https://cdn.example/1.m3u8' },
  'show:2': { title: 'Second', url: 'https://cdn.example/2.m3u8' },
  'show:geo': { title: 'Elsewhere', blocked: 'Only in Sweden.' },
};

const shows: Connector<Show> = {
  type: 'example/show',
  fetch: async (id) => {
    const show = SHOWS[id];
    if (show === undefined) throw new Error(`no ${id}`);
    return show;
  },
  resolve: (show) => ({
    sources: show.url === undefined ? [] : [{ url: show.url }],
    ...(show.blocked === undefined ? {} : { block: { message: show.blocked } }),
    metadata: {
      title: show.title,
      subtitle: 'Example TV',
      image: 'https://cdn.example/art.jpg',
      poster: 'https://cdn.example/poster.jpg',
      markers: [{ start: 0, end: 30, kind: 'opening-credits' }],
    },
  }),
};

function mount(): MatteboxPlayerElement {
  const player = new MatteboxPlayerElement({ handlers: [stub], connectors: [shows] });
  fakeMedia(player.video);
  player.setAttribute('controls', 'custom');
  player.append(...compose());
  document.body.append(player);
  return player;
}

function programmes(player: MatteboxPlayerElement): (Programme | null)[] {
  const seen: (Programme | null)[] = [];
  player.addEventListener('programmechange', (event) => seen.push(event.detail));
  return seen;
}

/** A tracker that writes down what the player told it. */
function recorder(name = 'recorder'): Tracker & { readonly log: string[] } {
  const log: string[] = [];
  return {
    name,
    log,
    get session() {
      return `${name}-${log.length}`;
    },
    start: (programme) => log.push(`start ${programme.id ?? programme.sources[0]?.url}`),
    stop: () => log.push('stop'),
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('a connector source', () => {
  it('resolves the src and type attributes, and shows the metadata', async () => {
    const player = mount();
    const seen = programmes(player);
    player.setAttribute('type', 'example/show');
    player.setAttribute('src', 'show:1');

    await expect.poll(() => player.player?.session?.source.url).toBe('https://cdn.example/1.m3u8');
    expect(seen).toHaveLength(1);
    expect(player.programme?.id).toBe('show:1');
    expect(player.programme?.metadata?.title).toBe('First');
    expect(player.video.getAttribute('poster')).toBe('https://cdn.example/poster.jpg');
    expect(player.markers.list).toEqual([{ start: 0, end: 30, kind: 'opening-credits' }]);
    const title = player.querySelector('mbx-title');
    expect(title?.shadowRoot?.querySelector('[part~="heading"]')?.textContent).toBe('First');
    expect(title?.shadowRoot?.querySelector('[part~="subheading"]')?.textContent).toBe(
      'Example TV',
    );
    // The programme's image is the poster: the title draws no artwork of its own.
    expect(title?.shadowRoot?.querySelector<HTMLImageElement>('[part~="artwork"]')?.hidden).toBe(
      true,
    );
  });

  it('plays injected data through sources, and keeps the page poster and title', async () => {
    const player = mount();
    player.setAttribute('poster', 'https://page.example/own.jpg');
    player.querySelector('mbx-title')?.setAttribute('heading', 'Page heading');
    player.sources = [
      { type: 'example/show', data: { title: 'Injected', url: 'https://cdn.example/i.mpd' } },
    ];

    await expect.poll(() => player.player?.session?.source.url).toBe('https://cdn.example/i.mpd');
    expect(player.programme?.data).toEqual({ title: 'Injected', url: 'https://cdn.example/i.mpd' });
    expect(player.video.getAttribute('poster')).toBe('https://page.example/own.jpg');
    const title = player.querySelector('mbx-title');
    expect(title?.shadowRoot?.querySelector('[part~="heading"]')?.textContent).toBe('Page heading');
  });

  it('shows the block of a blocked programme, and loads nothing', async () => {
    const player = mount();
    player.setAttribute('type', 'example/show');
    player.setAttribute('src', 'show:geo');

    await expect.poll(() => player.blocked).toEqual({ message: 'Only in Sweden.' });
    expect(player.player?.session ?? null).toBeNull();
    const screen = player.querySelector<HTMLElement>('mbx-error-screen');
    expect(screen?.hidden).toBe(false);
    expect(screen?.shadowRoot?.querySelector('[part~="message"]')?.textContent).toBe(
      'Only in Sweden.',
    );
  });

  it('reports a fetch that fails as a connector error', async () => {
    const player = mount();
    const codes: string[] = [];
    player.addEventListener('error', (event) => codes.push(event.detail.code));
    player.setAttribute('type', 'example/show');
    player.setAttribute('src', 'show:missing');

    await expect.poll(() => codes).toEqual(['CONNECTOR_FAILED']);
    expect(player.error?.category).toBe('connector');
  });
});

describe('trackers', () => {
  it('start at each programme and stop at its end', async () => {
    const player = mount();
    const tracker = recorder();
    player.trackers.add(tracker);
    player.setAttribute('type', 'example/show');
    player.setAttribute('src', 'show:1');
    await expect.poll(() => tracker.log).toEqual(['start show:1']);

    player.setAttribute('src', 'show:2');
    await expect.poll(() => tracker.log).toEqual(['start show:1', 'stop', 'start show:2']);

    player.remove();
    await expect.poll(() => tracker.log.at(-1)).toBe('stop');
  });

  it('start at once when added during a programme, and stop at once when removed', async () => {
    const player = mount();
    player.setAttribute('src', 'https://cdn.example/plain.m3u8');
    await expect.poll(() => player.programme).not.toBeNull();
    const changes: number[] = [];
    player.addEventListener('trackerschange', (event) => changes.push(event.detail.length));

    const tracker = recorder();
    player.trackers.add(tracker);
    expect(tracker.log).toEqual(['start https://cdn.example/plain.m3u8']);
    expect(player.trackers.has(tracker)).toBe(true);
    expect(player.trackers.list).toEqual([tracker]);

    expect(player.trackers.delete(tracker)).toBe(true);
    expect(tracker.log).toEqual(['start https://cdn.example/plain.m3u8', 'stop']);
    expect(player.trackers.delete(tracker)).toBe(false);
    expect(changes).toEqual([1, 0]);
  });

  it('see a failed programme, then its error', async () => {
    const player = mount();
    const log: string[] = [];
    player.trackers.add({
      name: 'errors',
      start: (programme, host) => {
        log.push(`start ${programme.id}`);
        host.addEventListener('error', (event) => {
          log.push((event as unknown as CustomEvent<{ code: string }>).detail.code);
        });
      },
      stop: () => log.push('stop'),
    });
    player.setAttribute('type', 'example/show');
    player.setAttribute('src', 'show:missing');

    await expect.poll(() => log).toEqual(['start show:missing', 'CONNECTOR_FAILED']);
  });
});
