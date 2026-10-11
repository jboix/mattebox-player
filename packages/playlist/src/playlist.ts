/**
 * The playlist controller: a list of items for one <mattebox-player>, the
 * one that plays, and the rules for what plays next. It loads an item by
 * writing the player's own attributes, so every session kind, the engine
 * or the browser's own, plays it the same way.
 *
 * - The end of an item plays the next one (`autoadvance`), or the same one
 *   again under repeat one.
 * - Previous goes to the previous item within the first seconds of one,
 *   and restarts it after them, as a music player does. A live item has no
 *   start to go back to: previous always moves on.
 * - A fatal error moves to the next item after a delay (`skipOnError`).
 * - The system's own controls, media keys, a lock screen, a TV remote, go
 *   to next and previous through the Media Session API.
 */
import type { Marker, PlayerHost } from '@mattebox/player';
import type { Order, Random, RepeatMode } from './order.js';
import { after, arrange, before, random } from './order.js';

export type { RepeatMode } from './order.js';

/** One entry: what the player plays, and what the list shows of it. */
export interface PlaylistItem {
  readonly src: string;
  readonly type?: string;
  readonly poster?: string;
  /** The title's heading, subheading and artwork, as <mbx-title> takes them. */
  readonly heading?: string;
  readonly subheading?: string;
  readonly artwork?: string;
  readonly thumbnails?: string;
  readonly chapters?: string;
  readonly licenseUrl?: string;
  readonly certificateUrl?: string;
  /** Credits and blocked parts, for `player.markers`. */
  readonly markers?: readonly Marker[];
  /** Where playback starts, in seconds. */
  readonly startTime?: number;
  /** The length the list shows, in seconds, before the media says. */
  readonly duration?: number;
  /** Anything of the page's own. */
  readonly data?: unknown;
}

export interface PlaylistOptions {
  /** `none` (the default), `all` to loop the list, `one` to loop the item. */
  readonly repeat?: RepeatMode;
  /** Plays the items in a random order, the list unchanged. Off by default. */
  readonly shuffle?: boolean;
  /** Plays the next item when one ends. On by default. */
  readonly autoadvance?: boolean;
  /** Seconds into an item before previous restarts it instead. 3 by default. */
  readonly previousThreshold?: number;
  /** Milliseconds after a fatal error before the next item, or false to stay. 3000 by default. */
  readonly skipOnError?: number | false;
  /** For tests: the random source of shuffle. */
  readonly random?: Random;
}

/** What `change` says changed. */
export interface PlaylistChange {
  readonly items: boolean;
  readonly index: boolean;
  readonly mode: boolean;
}

export interface Playlist extends EventTarget {
  readonly player: PlayerHost;
  readonly items: readonly PlaylistItem[];
  /** The index of the item that plays, in `items`, or -1. */
  readonly index: number;
  readonly item: PlaylistItem | null;
  /** The item that plays after this one, under the repeat and shuffle in force, or null. */
  readonly upcoming: PlaylistItem | null;
  repeat: RepeatMode;
  shuffle: boolean;
  autoadvance: boolean;
  /** Replaces the list and plays `start`, the first item by default. */
  load(items: readonly PlaylistItem[], start?: number): void;
  /** Adds items at the end. */
  push(...items: readonly PlaylistItem[]): void;
  /** Removes and inserts items, as `Array.prototype.splice`. The item that plays keeps playing. */
  splice(start: number, deleteCount: number, ...items: readonly PlaylistItem[]): void;
  /** Empties the list. What plays keeps playing. */
  clear(): void;
  /** Plays the item at `index`. */
  select(index: number): void;
  next(): void;
  previous(): void;
  hasNext(): boolean;
  hasPrevious(): boolean;
  /** None, then all, then one, then none again. Returns the new mode. */
  toggleRepeat(): RepeatMode;
  /** Stays at the end of this item instead of moving on, as an up next card's cancel asks. */
  stay(): void;
  /** Lets go of the player: its listeners, the system controls, and the registry. */
  dispose(): void;
}

/** One playlist per player, so the elements and the page's script find the same one. */
const registry = new WeakMap<HTMLElement, Playlist>();

/** The playlist of `player`, or null. */
export function playlistOf(player: HTMLElement): Playlist | null {
  return registry.get(player) ?? null;
}

const REPEATS: readonly RepeatMode[] = ['none', 'all', 'one'];

/**
 * How long a preload counts, in milliseconds. The engine keeps a preloaded
 * manifest for 30 seconds, and closing credits or a pause last longer.
 * Wanted: one preload per item. Had to: ask again before the engine drops
 * it. The surface that would make it one call: a lifetime option on
 * `engine.preload`.
 */
const PRELOAD_FRESH = 25_000;

/** The player's attributes an item sets, by item field. Absent fields remove them. */
const ATTRIBUTES: ReadonlyArray<readonly [keyof PlaylistItem, string]> = [
  ['type', 'type'],
  ['poster', 'poster'],
  ['thumbnails', 'thumbnails'],
  ['chapters', 'chapters'],
  ['licenseUrl', 'license-url'],
  ['certificateUrl', 'certificate-url'],
];

const TITLE: ReadonlyArray<readonly [keyof PlaylistItem, string]> = [
  ['heading', 'heading'],
  ['subheading', 'subheading'],
  ['artwork', 'artwork'],
];

function write(node: Element, name: string, value: unknown): void {
  if (typeof value === 'string') node.setAttribute(name, value);
  else node.removeAttribute(name);
}

/**
 * The playlist of `player`: the one it already has, with the options
 * applied, or a new one.
 */
export function createPlaylist(player: PlayerHost, options: PlaylistOptions = {}): Playlist {
  const existing = registry.get(player);
  if (existing !== undefined) {
    if (options.repeat !== undefined) existing.repeat = options.repeat;
    if (options.shuffle !== undefined) existing.shuffle = options.shuffle;
    if (options.autoadvance !== undefined) existing.autoadvance = options.autoadvance;
    return existing;
  }
  const rand = options.random ?? random;
  const threshold = options.previousThreshold ?? 3;
  const skipDelay = options.skipOnError ?? 3000;
  const video = player.video;
  const target = new EventTarget();
  let items: PlaylistItem[] = [];
  let order: Order = { sequence: [], position: -1 };
  let repeat: RepeatMode = options.repeat ?? 'none';
  let shuffle = options.shuffle ?? false;
  let autoadvance = options.autoadvance ?? true;
  /** Play once the next session is in: the viewer was watching, or the list moved on by itself. */
  let resume = false;
  /** Seek here once the item's metadata is in. */
  let start: number | null = null;
  let skipTimer = 0;
  /** The index whose end stays put, by `stay`; -1 for none. */
  let stayed = -1;
  /** The index whose next item was preloaded, and when, so it is asked once while that preload counts. */
  let preloaded = -1;
  let preloadedAt = 0;

  const index = (): number => order.sequence[order.position] ?? -1;

  function changed(change: Partial<PlaylistChange>): void {
    const detail: PlaylistChange = { items: false, index: false, mode: false, ...change };
    target.dispatchEvent(new CustomEvent('change', { detail }));
    session();
  }

  /** Writes the item into the player: its attributes, its title, its markers, the source last. */
  function play(position: number, keepPlaying: boolean): void {
    clearTimeout(skipTimer);
    const item = items[order.sequence[position] ?? -1];
    if (item === undefined) return;
    order = { ...order, position };
    stayed = -1;
    preloaded = -1;
    resume = keepPlaying;
    start = item.startTime ?? null;
    for (const [field, name] of ATTRIBUTES) write(player, name, item[field]);
    const title = player.querySelector('mbx-title');
    if (title !== null) for (const [field, name] of TITLE) write(title, name, item[field]);
    // The source last: every attribute above reloads, and the last load is
    // the one that counts. Markers after it, since a new source clears them.
    player.setAttribute('src', item.src);
    player.markers.set(item.markers ?? []);
    changed({ index: true });
  }

  /** The state of the list for a new item list: the item that plays stays, wherever it went. */
  function relist(next: PlaylistItem[]): void {
    const current = items[index()];
    items = next;
    // By reference, or by source: markup builds new item objects on every
    // change, and the same source is the same item to a viewer.
    let at = current === undefined ? -1 : items.indexOf(current);
    if (at < 0 && current !== undefined) at = items.findIndex((item) => item.src === current.src);
    order = arrange(items.length, at, shuffle, rand);
  }

  /** The system's own controls and what they show, for the item that plays. */
  function session(): void {
    const media = typeof navigator === 'undefined' ? undefined : navigator.mediaSession;
    if (media === undefined) return;
    const item = items[index()];
    try {
      media.setActionHandler('nexttrack', api.hasNext() ? () => api.next() : null);
      media.setActionHandler('previoustrack', api.hasPrevious() ? () => api.previous() : null);
      if (item !== undefined && typeof MediaMetadata !== 'undefined') {
        media.metadata = new MediaMetadata({
          title: item.heading ?? '',
          artist: item.subheading ?? '',
          ...(item.artwork === undefined && item.poster === undefined
            ? {}
            : { artwork: [{ src: (item.artwork ?? item.poster) as string }] }),
        });
      }
    } catch {
      // A browser that knows the session but not one of these actions.
    }
  }

  const onEnded = (): void => {
    if (repeat === 'one') {
      video.currentTime = 0;
      video.play().catch(() => undefined);
      return;
    }
    if (!autoadvance || stayed === index()) return;
    const position = after(order, repeat);
    if (position >= 0) play(position, true);
  };

  const onError = (event: Event): void => {
    const error = (event as CustomEvent<{ readonly fatal?: boolean }>).detail;
    if (skipDelay === false || error?.fatal !== true || items.length === 0) return;
    clearTimeout(skipTimer);
    const skipped = index();
    skipTimer = setTimeout(() => {
      const position = after(order, repeat);
      target.dispatchEvent(
        new CustomEvent('skip', { detail: { index: skipped, item: items[skipped], error } }),
      );
      if (position >= 0 && position !== order.position) play(position, true);
    }, skipDelay) as unknown as number;
  };

  /**
   * Near an item's end, the next one's manifest loads ahead, so its start
   * saves that request: from its closing credits, or 30 seconds before its
   * end. The core asks the handler that will play the next item, so an
   * engine item is preloaded also while the browser plays this one itself.
   */
  const onTime = (): void => {
    const at = index();
    const next = api.upcoming;
    const now = Date.now();
    if (next === null || next === items[at]) return;
    if (preloaded === at && now - preloadedAt < PRELOAD_FRESH) return;
    const left = video.duration - video.currentTime;
    const credits = player.markers
      .within(video.currentTime)
      .some((marker) => marker.kind === 'closing-credits');
    if (!credits && !(left <= 30)) return;
    preloaded = at;
    preloadedAt = now;
    player.player
      ?.preload(next.type === undefined ? { url: next.src } : { url: next.src, type: next.type })
      .catch(() => undefined);
  };

  const onSource = (): void => {
    if (!resume) return;
    resume = false;
    video.play().catch(() => undefined);
  };

  const onMetadata = (): void => {
    if (start === null) return;
    const at = start;
    start = null;
    video.currentTime = at;
  };

  video.addEventListener('ended', onEnded);
  video.addEventListener('timeupdate', onTime);
  video.addEventListener('loadedmetadata', onMetadata);
  player.addEventListener('error', onError);
  player.addEventListener('sourcechange', onSource);

  /** Whether playback is running, so a move keeps it running. */
  const running = (): boolean => !video.paused && !video.ended;

  // Descriptors, not Object.assign, which would copy each getter's value
  // once instead of the getter.
  const api = Object.defineProperties(
    target,
    Object.getOwnPropertyDescriptors({
      player,
      get items(): readonly PlaylistItem[] {
        return items;
      },
      get index(): number {
        return index();
      },
      get item(): PlaylistItem | null {
        return items[index()] ?? null;
      },
      get upcoming(): PlaylistItem | null {
        if (repeat === 'one') return items[index()] ?? null;
        return items[order.sequence[after(order, repeat)] ?? -1] ?? null;
      },
      get repeat(): RepeatMode {
        return repeat;
      },
      set repeat(mode: RepeatMode) {
        if (mode === repeat) return;
        repeat = mode;
        changed({ mode: true });
      },
      get shuffle(): boolean {
        return shuffle;
      },
      set shuffle(on: boolean) {
        if (on === shuffle) return;
        shuffle = on;
        order = arrange(items.length, index(), shuffle, rand);
        changed({ mode: true });
      },
      get autoadvance(): boolean {
        return autoadvance;
      },
      set autoadvance(on: boolean) {
        if (on === autoadvance) return;
        autoadvance = on;
        changed({ mode: true });
      },
      load(next: readonly PlaylistItem[], first = 0): void {
        items = [...next];
        order = arrange(items.length, -1, false, rand);
        if (shuffle) order = arrange(items.length, first, true, rand);
        changed({ items: true });
        if (items[first] !== undefined) play(order.sequence.indexOf(first), running());
      },
      push(...more: readonly PlaylistItem[]): void {
        relist([...items, ...more]);
        changed({ items: true });
      },
      splice(at: number, deleteCount: number, ...inserted: readonly PlaylistItem[]): void {
        const next = [...items];
        next.splice(at, deleteCount, ...inserted);
        relist(next);
        changed({ items: true });
      },
      clear(): void {
        items = [];
        order = { sequence: [], position: -1 };
        changed({ items: true, index: true });
      },
      select(at: number): void {
        const position = order.sequence.indexOf(at);
        if (position < 0) return;
        play(position, running() || video.ended);
      },
      next(): void {
        const position = after(order, repeat);
        if (position >= 0) play(position, running() || video.ended);
      },
      previous(): void {
        const live = !Number.isFinite(video.duration);
        if (!live && video.currentTime > threshold) {
          video.currentTime = 0;
          return;
        }
        const position = before(order, repeat);
        if (position >= 0) play(position, running());
      },
      hasNext(): boolean {
        return after(order, repeat) >= 0;
      },
      hasPrevious(): boolean {
        return before(order, repeat) >= 0;
      },
      stay(): void {
        stayed = index();
      },
      toggleRepeat(): RepeatMode {
        api.repeat = REPEATS[(REPEATS.indexOf(repeat) + 1) % REPEATS.length] as RepeatMode;
        return repeat;
      },
      dispose(): void {
        clearTimeout(skipTimer);
        video.removeEventListener('ended', onEnded);
        video.removeEventListener('timeupdate', onTime);
        video.removeEventListener('loadedmetadata', onMetadata);
        player.removeEventListener('error', onError);
        player.removeEventListener('sourcechange', onSource);
        const media = typeof navigator === 'undefined' ? undefined : navigator.mediaSession;
        try {
          media?.setActionHandler('nexttrack', null);
          media?.setActionHandler('previoustrack', null);
        } catch {
          // As in `session`.
        }
        registry.delete(player);
        player.dispatchEvent(new CustomEvent('playlist'));
      },
    }),
  ) as Playlist;
  registry.set(player, api);
  // The elements follow the player's playlist, whenever it comes.
  player.dispatchEvent(new CustomEvent('playlist'));
  return api;
}
