/**
 * The viewer's preferences: one store per storage key, shared by every
 * player on the page and by the page's own elements. A store without a key
 * keeps its values in memory, for as long as the page is open. A store
 * with one keeps them in localStorage, or in the storage the page gives,
 * under that key, and hears the writes of the page's other tabs. Every
 * storage call sits in `try`: a browser that blocks storage keeps the
 * values in memory instead.
 */

/** A track the viewer chose: its language, and its kind in HTML's words. */
export interface TrackChoice {
  readonly language: string;
  /** `main`, `description` or `enhanced-speech` for audio; `subtitles` or `captions` for text. */
  readonly kind: string;
}

/** The look of the subtitles: the player's `subtitle-size` and `subtitle-background`. */
export interface SubtitleLook {
  readonly size?: string;
  readonly background?: string;
}

/**
 * Every key a store holds, with its type. A package of your own adds its
 * keys through declaration merging, under a prefix of its name:
 *
 * ```ts
 * declare module '@mattebox/player-preferences' {
 *   interface Preferences {
 *     'my-app.theme': 'dark' | 'light';
 *   }
 * }
 * ```
 */
export interface Preferences {
  volume: number;
  muted: boolean;
  rate: number;
  /** The height of the quality the viewer pinned, or null for Auto. */
  quality: number | null;
  audio: TrackChoice;
  /** Null for subtitles off. */
  subtitles: TrackChoice | null;
  'subtitle-look': SubtitleLook;
}

/** Where a store keeps its values: localStorage, sessionStorage, or an object of your own with these two methods. */
export type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface PreferenceStore {
  /** The value of `key`, or undefined when the viewer has none. */
  get<K extends keyof Preferences>(key: K): Preferences[K] | undefined;
  /** Sets `key`. Undefined removes it. */
  set<K extends keyof Preferences>(key: K, value: Preferences[K] | undefined): void;
  /** Calls `fn` when `key` changes, here or in another tab, until the returned function runs. */
  on<K extends keyof Preferences>(
    key: K,
    fn: (value: Preferences[K] | undefined) => void,
  ): () => void;
}

export interface PreferenceOptions {
  /** The storage key. Without one, the store keeps its values in memory. */
  readonly key?: string;
  /** The storage under `key`. localStorage by default. */
  readonly storage?: PreferenceStorage;
}

/** The format of the stored entry. An entry of another version is ignored. */
const VERSION = 1;

/** By storage key, and by the empty key for the memory store. */
const stores = new Map<string, PreferenceStore>();

type Values = Record<string, unknown>;

function read(storage: PreferenceStorage | null, key: string): Values {
  try {
    const entry = JSON.parse(storage?.getItem(key) ?? 'null') as {
      version?: number;
      values?: Values;
    } | null;
    return entry?.version === VERSION && typeof entry.values === 'object' && entry.values !== null
      ? entry.values
      : {};
  } catch {
    return {};
  }
}

function defaultStorage(): PreferenceStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The store for `options.key`: the same object for the same key. The first call's `storage` applies. */
export function preferences(options: PreferenceOptions = {}): PreferenceStore {
  const key = options.key ?? '';
  const known = stores.get(key);
  if (known !== undefined) return known;
  const storage = key === '' ? null : (options.storage ?? defaultStorage());
  let values = read(storage, key);
  const listeners = new Map<string, Set<(value: never) => void>>();
  const tell = (name: string): void => {
    for (const fn of listeners.get(name) ?? []) fn(values[name] as never);
  };
  // Another tab wrote the entry: take its values, and tell what changed.
  if (storage !== null && typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key !== key || event.storageArea !== storage) return;
      const before = values;
      values = read(storage, key);
      for (const name of new Set([...Object.keys(before), ...Object.keys(values)])) {
        if (JSON.stringify(before[name]) !== JSON.stringify(values[name])) tell(name);
      }
    });
  }
  const store: PreferenceStore = {
    get: (name) => values[name] as never,
    set(name, value) {
      if (JSON.stringify(values[name]) === JSON.stringify(value)) return;
      values = { ...values };
      if (value === undefined) delete values[name];
      else values[name] = value;
      try {
        storage?.setItem(key, JSON.stringify({ version: VERSION, values }));
      } catch {
        // Full or blocked: the value stays in memory for this page.
      }
      tell(name);
    },
    on(name, fn) {
      const set = listeners.get(name) ?? new Set();
      listeners.set(name, set);
      set.add(fn as (value: never) => void);
      return () => {
        set.delete(fn as (value: never) => void);
      };
    },
  };
  stores.set(key, store);
  return store;
}
