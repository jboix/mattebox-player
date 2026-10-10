import type { Marker, PlayerHost } from '@mattebox/player';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlaylistChange, PlaylistItem } from '../../src/playlist.js';
import { createPlaylist, playlistOf } from '../../src/playlist.js';

/** A video that holds a time, a duration and a play state, and fires what it is told. */
function fakeVideo() {
  const video = Object.assign(new EventTarget(), {
    currentTime: 0,
    duration: 100,
    paused: true,
    ended: false,
    plays: 0,
    play() {
      video.plays += 1;
      video.paused = false;
      video.ended = false;
      return Promise.resolve();
    },
  });
  return video;
}

/** A player that records its attributes and markers, with a title, as the page composes it. */
function fakePlayer() {
  const video = fakeVideo();
  const attributes = new Map<string, string>();
  const title = new Map<string, string>();
  const writes: string[] = [];
  const markers: Array<readonly Marker[]> = [];
  const preloads: string[] = [];
  const element = (store: Map<string, string>) => ({
    setAttribute(name: string, value: string) {
      store.set(name, value);
      if (store === attributes) writes.push(name);
    },
    removeAttribute(name: string) {
      store.delete(name);
    },
    getAttribute: (name: string) => store.get(name) ?? null,
  });
  const player = Object.assign(new EventTarget(), element(attributes), {
    video,
    markers: {
      set(list: readonly Marker[]) {
        markers.push(list);
        writes.push('markers');
      },
      within: (time: number) =>
        (markers[markers.length - 1] ?? []).filter((m) => m.start <= time && time < m.end),
    },
    engine: {
      preload(src: string) {
        preloads.push(src);
        return Promise.resolve();
      },
    },
    querySelector: (tag: string) => (tag === 'mbx-title' ? element(title) : null),
  });
  return {
    player: player as unknown as PlayerHost,
    video,
    attributes,
    title,
    writes,
    markers,
    preloads,
  };
}

const item = (name: string, extra: Partial<PlaylistItem> = {}): PlaylistItem => ({
  src: `https://cdn.example/${name}.m3u8`,
  heading: name,
  ...extra,
});

const ITEMS = [item('one'), item('two'), item('three')];

/** The playlist's session coming in, as the player says it once the source loads. */
function loaded(player: PlayerHost): void {
  player.dispatchEvent(new CustomEvent('sourcechange', { detail: {} }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('a playlist', () => {
  it('loads the first item into the player: its attributes, its title, the source last, then its markers', () => {
    const { player, attributes, title, writes, markers } = fakePlayer();
    const credits: Marker = { start: 0, end: 10, kind: 'opening-credits' };
    const playlist = createPlaylist(player);
    playlist.load([
      item('one', { poster: 'p.jpg', licenseUrl: 'https://license', markers: [credits] }),
      item('two'),
    ]);
    expect(playlist.index).toBe(0);
    expect(attributes.get('src')).toBe('https://cdn.example/one.m3u8');
    expect(attributes.get('poster')).toBe('p.jpg');
    expect(attributes.get('license-url')).toBe('https://license');
    expect(title.get('heading')).toBe('one');
    expect(writes.slice(-2)).toEqual(['src', 'markers']);
    expect(markers.at(-1)).toEqual([credits]);
    // The next item clears what it does not carry.
    playlist.next();
    expect(attributes.has('poster')).toBe(false);
    expect(attributes.has('license-url')).toBe(false);
    expect(markers.at(-1)).toEqual([]);
  });

  it('is one per player, for the script and the markup alike', () => {
    const { player } = fakePlayer();
    const playlist = createPlaylist(player);
    expect(createPlaylist(player, { repeat: 'all' })).toBe(playlist);
    expect(playlist.repeat).toBe('all');
    expect(playlistOf(player as unknown as HTMLElement)).toBe(playlist);
    playlist.dispose();
    expect(playlistOf(player as unknown as HTMLElement)).toBeNull();
  });

  it('reports what changed', () => {
    const { player } = fakePlayer();
    const playlist = createPlaylist(player);
    const changes: PlaylistChange[] = [];
    playlist.addEventListener('change', (event) =>
      changes.push((event as CustomEvent<PlaylistChange>).detail),
    );
    playlist.load(ITEMS);
    playlist.repeat = 'one';
    expect(changes).toEqual([
      { items: true, index: false, mode: false },
      { items: false, index: true, mode: false },
      { items: false, index: false, mode: true },
    ]);
  });

  it('moves next and previous, and stops at the ends without repeat', () => {
    const { player } = fakePlayer();
    const playlist = createPlaylist(player);
    playlist.load(ITEMS);
    expect(playlist.hasPrevious()).toBe(false);
    playlist.next();
    playlist.next();
    expect(playlist.index).toBe(2);
    expect(playlist.hasNext()).toBe(false);
    playlist.next();
    expect(playlist.index).toBe(2);
    playlist.previous();
    expect(playlist.index).toBe(1);
  });

  it('restarts the item after the first seconds instead of going back, but not live', () => {
    const { player, video } = fakePlayer();
    const playlist = createPlaylist(player);
    playlist.load(ITEMS, 1);
    video.currentTime = 30;
    playlist.previous();
    expect([playlist.index, video.currentTime]).toEqual([1, 0]);
    video.currentTime = 30;
    video.duration = Number.POSITIVE_INFINITY;
    playlist.previous();
    expect(playlist.index).toBe(0);
  });

  it('cycles repeat none, all, one, and repeat all wraps both ways', () => {
    const { player } = fakePlayer();
    const playlist = createPlaylist(player);
    playlist.load(ITEMS);
    expect([playlist.toggleRepeat(), playlist.toggleRepeat(), playlist.toggleRepeat()]).toEqual([
      'all',
      'one',
      'none',
    ]);
    playlist.repeat = 'all';
    playlist.previous();
    expect(playlist.index).toBe(2);
    playlist.next();
    expect(playlist.index).toBe(0);
  });

  it('plays the next item at the end, and starts it once its session is in', () => {
    const { player, video } = fakePlayer();
    const playlist = createPlaylist(player);
    playlist.load(ITEMS);
    video.ended = true;
    video.dispatchEvent(new Event('ended'));
    expect(playlist.index).toBe(1);
    expect(video.plays).toBe(0);
    loaded(player);
    expect(video.plays).toBe(1);
  });

  it('replays the item under repeat one, and stays at the end without autoadvance', () => {
    const { player, video } = fakePlayer();
    const playlist = createPlaylist(player, { repeat: 'one' });
    playlist.load(ITEMS);
    video.currentTime = 100;
    video.dispatchEvent(new Event('ended'));
    expect([playlist.index, video.currentTime, video.plays]).toEqual([0, 0, 1]);
    playlist.repeat = 'none';
    playlist.autoadvance = false;
    video.dispatchEvent(new Event('ended'));
    expect(playlist.index).toBe(0);
    expect(playlist.upcoming).toBe(ITEMS[1]);
  });

  it('stays at the end of the item the viewer chose to stay on, and only that one', () => {
    const { player, video } = fakePlayer();
    const playlist = createPlaylist(player);
    playlist.load(ITEMS);
    playlist.stay();
    video.dispatchEvent(new Event('ended'));
    expect(playlist.index).toBe(0);
    playlist.next();
    video.dispatchEvent(new Event('ended'));
    expect(playlist.index).toBe(2);
  });

  it('preloads the next item once, from its closing credits or 30 seconds before the end', () => {
    const { player, video, preloads } = fakePlayer();
    const playlist = createPlaylist(player);
    playlist.load([
      item('one', { markers: [{ start: 50, end: 100, kind: 'closing-credits' }] }),
      item('two'),
      item('three'),
    ]);
    video.currentTime = 40;
    video.dispatchEvent(new Event('timeupdate'));
    expect(preloads).toEqual([]);
    video.currentTime = 55;
    video.dispatchEvent(new Event('timeupdate'));
    video.currentTime = 60;
    video.dispatchEvent(new Event('timeupdate'));
    expect(preloads).toEqual([ITEMS[1]?.src]);
    playlist.next();
    video.currentTime = 69;
    video.dispatchEvent(new Event('timeupdate'));
    expect(preloads).toHaveLength(1);
    video.currentTime = 71;
    video.dispatchEvent(new Event('timeupdate'));
    expect(preloads).toEqual([ITEMS[1]?.src, ITEMS[2]?.src]);
  });

  it('shuffles the play order and keeps the list; off goes back to the list order', () => {
    const { player } = fakePlayer();
    const items = [...ITEMS, item('four'), item('five')];
    // Picks the last candidate: the rest come out in reverse.
    const playlist = createPlaylist(player, { random: (below) => below - 1 });
    playlist.load(items, 1);
    playlist.shuffle = true;
    expect(playlist.items).toEqual(items);
    expect(playlist.index).toBe(1);
    const visited = [playlist.index];
    while (playlist.hasNext()) {
      playlist.next();
      visited.push(playlist.index);
    }
    expect([...visited].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(visited).not.toEqual([1, 2, 3, 4, 0]);
    const at = playlist.index;
    playlist.shuffle = false;
    expect(playlist.index).toBe(at);
    expect(playlist.hasNext()).toBe(at < 4);
  });

  it('keeps what plays through edits to the list, even rebuilt with new objects', () => {
    const { player } = fakePlayer();
    const playlist = createPlaylist(player);
    playlist.load(ITEMS, 1);
    playlist.splice(0, 1);
    expect(playlist.index).toBe(0);
    expect(playlist.item?.heading).toBe('two');
    playlist.push(item('four'));
    expect(playlist.items.length).toBe(3);
    playlist.splice(0, playlist.items.length, item('zero'), item('two'), item('four'));
    expect(playlist.index).toBe(1);
    expect(playlist.upcoming?.heading).toBe('four');
  });

  it('skips a failed item after the delay, and says so', () => {
    vi.useFakeTimers();
    const { player } = fakePlayer();
    const playlist = createPlaylist(player, { skipOnError: 1000 });
    playlist.load(ITEMS);
    const skips: unknown[] = [];
    playlist.addEventListener('skip', (event) => skips.push((event as CustomEvent).detail));
    player.dispatchEvent(new CustomEvent('error', { detail: { fatal: false } }));
    vi.advanceTimersByTime(2000);
    expect(playlist.index).toBe(0);
    const error = { fatal: true, code: 'MEDIA_DECODE_ERROR' };
    player.dispatchEvent(new CustomEvent('error', { detail: error }));
    vi.advanceTimersByTime(999);
    expect(playlist.index).toBe(0);
    vi.advanceTimersByTime(1);
    expect(playlist.index).toBe(1);
    expect(skips).toEqual([{ index: 0, item: ITEMS[0], error }]);
  });

  it('starts an item at its start time once its metadata is in', () => {
    const { player, video } = fakePlayer();
    createPlaylist(player).load([item('one', { startTime: 42 })]);
    video.dispatchEvent(new Event('loadedmetadata'));
    expect(video.currentTime).toBe(42);
    video.currentTime = 7;
    video.dispatchEvent(new Event('loadedmetadata'));
    expect(video.currentTime).toBe(7);
  });

  it("drives the system's next and previous, and names the item there", () => {
    const handlers = new Map<string, (() => void) | null>();
    const session = {
      metadata: null as unknown,
      setActionHandler: (name: string, fn: (() => void) | null) => handlers.set(name, fn),
    };
    vi.stubGlobal('navigator', { mediaSession: session });
    vi.stubGlobal(
      'MediaMetadata',
      class {
        constructor(readonly init: unknown) {}
      },
    );
    const { player } = fakePlayer();
    const playlist = createPlaylist(player);
    playlist.load([item('one', { subheading: 'S1', artwork: 'a.jpg' }), item('two')]);
    expect(handlers.get('previoustrack')).toBeNull();
    expect((session.metadata as { init: unknown }).init).toEqual({
      title: 'one',
      artist: 'S1',
      artwork: [{ src: 'a.jpg' }],
    });
    handlers.get('nexttrack')?.();
    expect(playlist.index).toBe(1);
    expect(handlers.get('nexttrack')).toBeNull();
    playlist.dispose();
    expect(handlers.get('previoustrack')).toBeNull();
  });
});
