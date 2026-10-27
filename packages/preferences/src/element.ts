/**
 * <mbx-preferences>: keeps the viewer's choices from one programme to the
 * next, and with `storage-key` from one visit to the next. It saves the
 * volume and mute, the playback rate, the quality pin as a height, the
 * audio and subtitle tracks as a language and a kind, and the subtitle
 * look. It puts them back at each load. It renders nothing.
 *
 * Only the viewer's changes are saved: the element ignores what it put
 * back itself, a forced subtitle track the engine chose, the rate of a
 * scan or of a live catch-up, and the `muted` a page sets for autoplay.
 * `except` names the keys the element leaves alone.
 */
import type { Mattebox } from 'mattebox';
import { Component } from './component.js';
import type { PlayerHost } from './host.js';
import type { PreferenceStore, Preferences, TrackChoice } from './store.js';
import { preferences } from './store.js';
import { best, engineChoice, nativeChoice } from './tracks.js';

/** The keys the element saves, in the words `except` takes. */
const KEYS = ['volume', 'muted', 'rate', 'quality', 'audio', 'subtitles', 'subtitle-look'] as const;
const SIZE = 'subtitle-size';
const BACKGROUND = 'subtitle-background';

/** What the element reads of the engine's trick play and live namespaces. */
interface Moving {
  readonly trick?: { readonly rate: number; readonly scrubbing: boolean };
  readonly live?: { readonly edge: number | null };
}

/** What the element reads and writes of a native `AudioTrack` or `TextTrack`. */
interface NativeTrack {
  readonly kind: string;
  readonly language: string;
  enabled?: boolean;
  mode?: string;
}

type Kind = 'audio' | 'subtitles';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export class MbxPreferences extends Component {
  static get observedAttributes(): readonly string[] {
    return ['storage-key'];
  }

  /** The store the element reads and writes: the memory one, or the one of `storage-key`. */
  declare store: PreferenceStore;
  declare private engine: Mattebox | null;
  /** The tracks the element put back for this load, which are not the viewer's choice. Absent before. */
  declare private put: Partial<Record<Kind, TrackChoice | null>>;
  /** The pin the element last saw, to tell the viewer's pick. */
  declare private pinned: string | null;
  /** The video loads, and its rate is the reset of the load until the element puts the stored one back. */
  declare private loading: boolean;
  declare private offEngine: (() => void) | null;
  /** The keys this element saved in its current store, which go along when `storage-key` changes. */
  declare private saved: Set<string>;

  constructor() {
    super();
    this.store = preferences();
    this.engine = null;
    this.put = {};
    this.pinned = null;
    this.loading = true;
    this.offEngine = null;
    this.saved = new Set();
  }

  attributeChangedCallback(): void {
    const key = this.getAttribute('storage-key');
    const next = preferences(key === null ? {} : { key });
    if (next === this.store) return;
    // The choices the viewer made before the key arrived, such as before a consent, go along.
    for (const name of this.saved) {
      next.set(name as keyof Preferences, this.store.get(name as keyof Preferences) as never);
    }
    this.saved = new Set();
    this.store = next;
  }

  /** Whether the element keeps `key`: every key, less the ones `except` names. */
  private keeps(key: (typeof KEYS)[number]): boolean {
    return !(this.getAttribute('except') ?? '').split(/\s+/).includes(key);
  }

  /** The stored value of `key`, or undefined when the element leaves it alone. */
  private stored<K extends (typeof KEYS)[number]>(key: K): Preferences[K] | undefined {
    return this.keeps(key) ? this.store.get(key) : undefined;
  }

  private save<K extends (typeof KEYS)[number]>(key: K, value: Preferences[K]): void {
    if (!this.keeps(key)) return;
    this.store.set(key, value);
    this.saved.add(key);
  }

  protected attach(player: PlayerHost): void {
    const video = player.video;
    const volume = this.stored('volume');
    if (volume !== undefined) video.volume = volume;
    // A page that mutes for autoplay decides the mute itself, until the
    // viewer unmutes. The player reflects the mute to `muted`, so the
    // page's own is the one there at attach.
    let pageMuted = player.hasAttribute('muted');
    const muted = this.stored('muted');
    if (muted !== undefined && !pageMuted) video.muted = muted;
    const look = this.stored('subtitle-look');
    if (look?.size !== undefined) player.setAttribute(SIZE, look.size);
    if (look?.background !== undefined) player.setAttribute(BACKGROUND, look.background);

    this.on(video, 'volumechange', () => {
      this.save('volume', video.volume);
      pageMuted = pageMuted && video.muted;
      if (!pageMuted) this.save('muted', video.muted);
    });
    const watch = new MutationObserver(() => {
      const size = player.getAttribute(SIZE);
      const background = player.getAttribute(BACKGROUND);
      this.save('subtitle-look', {
        ...(size === null ? {} : { size }),
        ...(background === null ? {} : { background }),
      });
    });
    watch.observe(player, { attributes: true, attributeFilter: [SIZE, BACKGROUND] });
    this.keep(() => {
      watch.disconnect();
    });

    this.on(video, 'loadstart', () => {
      this.loading = true;
      this.put = {};
    });
    this.on(video, 'loadedmetadata', () => {
      const rate = this.stored('rate');
      if (rate !== undefined) video.playbackRate = rate;
      this.loading = false;
      if (this.engine === null) this.restoreNative(player);
    });
    this.on(video, 'ratechange', () => {
      const moving = (this.engine ?? {}) as Moving;
      const trick = moving.trick;
      const live = moving.live?.edge != null || video.duration === Number.POSITIVE_INFINITY;
      if (this.loading || live || (trick !== undefined && (trick.rate !== 1 || trick.scrubbing))) {
        return;
      }
      this.save('rate', video.playbackRate);
    });
    // A pin comes from the quality menu, which a click or a key reaches; the engine announces none.
    this.on(player, 'click', () => {
      setTimeout(() => {
        this.notePin();
      }, 0);
    });
    for (const name of ['audioTracks', 'textTracks'] as const) {
      const list = (video as unknown as Record<string, EventTarget | undefined>)[name];
      if (list !== undefined) this.on(list, 'change', () => this.noteNative(player));
    }
    this.on(player, 'sourcechange', () => {
      this.follow(player.engine);
    });
    this.follow(player.engine);
    this.keep(() => {
      this.follow(null);
    });
  }

  /** Puts the stored tracks and pin back on each engine once its manifest lists them, and saves the viewer's changes. */
  private follow(engine: Mattebox | null): void {
    this.offEngine?.();
    this.offEngine = null;
    this.engine = engine;
    if (engine === null) return;
    let offChanged = (): void => undefined;
    let offSelected = (): void => undefined;
    const ready = (): void => {
      offChanged();
      this.restoreEngine(engine);
      offSelected = engine.on('tracks:selected', () => {
        this.noteEngine(engine);
      });
    };
    if (engine.tracks.available.length > 0) ready();
    else offChanged = engine.on('tracks:changed', ready);
    this.offEngine = () => {
      offChanged();
      offSelected();
    };
  }

  private restoreEngine(engine: Mattebox): void {
    const tracks = engine.tracks;
    for (const kind of ['audio', 'subtitles'] as const) {
      const type = kind === 'audio' ? 'audio' : 'text';
      const list = tracks.available.filter(
        (track) => track.contentType === type && tracks.selectable(track.id) && !track.forced,
      );
      const wanted = this.stored(kind);
      // Inside the engine's own listener a selection queues, so what the
      // element put back is what it asked for, not what `active` says yet.
      this.put[kind] = this.engineActive(engine, kind);
      if (wanted === null) {
        if (!(tracks.active('text')?.forced ?? false)) tracks.deselect('text');
        this.put[kind] = null;
      } else if (wanted !== undefined) {
        const active = tracks.active(type);
        const index = best(
          list.map(engineChoice),
          wanted,
          active === null ? -1 : list.indexOf(active),
        );
        const pick = list[index];
        if (pick !== undefined) {
          tracks.select(pick.id);
          this.put[kind] = engineChoice(pick);
        }
      }
    }
    const height = this.stored('quality');
    const quality = engine.quality;
    if (typeof height === 'number') {
      // The tallest at or under the height the viewer pinned, else the shortest.
      const fit = [...quality.selectable]
        .filter((rendition) => rendition.height !== undefined)
        .sort((a, b) => (b.height as number) - (a.height as number));
      const pick =
        fit.find((rendition) => (rendition.height as number) <= height) ?? fit[fit.length - 1];
      if (pick !== undefined) {
        quality.pin(pick.id);
        this.pinned = pick.id;
        return;
      }
    }
    this.pinned = quality.pinned;
  }

  /** The active track of `kind` as a choice: null for subtitles off, or for a forced track. */
  private engineActive(engine: Mattebox, kind: Kind): TrackChoice | null {
    const track = engine.tracks.active(kind === 'audio' ? 'audio' : 'text');
    return track === null || track.forced === true ? null : engineChoice(track);
  }

  private noteEngine(engine: Mattebox): void {
    for (const kind of ['audio', 'subtitles'] as const) {
      const now = this.engineActive(engine, kind);
      // A forced track replaces "off" on its own; the viewer's "off" came first.
      if (kind === 'subtitles' && now === null && engine.tracks.active('text') !== null) continue;
      if (kind === 'audio' && now === null) continue;
      if (same(now, this.put[kind])) continue;
      this.put[kind] = now;
      this.save(kind, now as TrackChoice);
    }
  }

  private notePin(): void {
    const quality = this.engine?.quality;
    if (quality === undefined || quality.pinned === this.pinned) return;
    this.pinned = quality.pinned;
    const height = quality.renditions.find((rendition) => rendition.id === this.pinned)?.height;
    this.save('quality', height ?? null);
  }

  /** The native session's audio and subtitle tracks, as Safari lists them. */
  private native(player: PlayerHost, kind: Kind): NativeTrack[] {
    const name = kind === 'audio' ? 'audioTracks' : 'textTracks';
    const list = (player.video as unknown as Record<string, ArrayLike<NativeTrack> | undefined>)[
      name
    ];
    const tracks = list === undefined ? [] : Array.from(list);
    return kind === 'audio'
      ? tracks
      : tracks.filter((track) => track.kind === 'subtitles' || track.kind === 'captions');
  }

  private nativeActive(player: PlayerHost, kind: Kind): TrackChoice | null {
    const on = this.native(player, kind).find((track) =>
      kind === 'audio' ? track.enabled === true : track.mode === 'showing',
    );
    return on === undefined ? null : nativeChoice(on);
  }

  private restoreNative(player: PlayerHost): void {
    for (const kind of ['audio', 'subtitles'] as const) {
      const tracks = this.native(player, kind);
      const wanted = this.stored(kind);
      if (wanted !== undefined && tracks.length > 0) {
        const choices = tracks.map(nativeChoice);
        const index = wanted === null ? -1 : best(choices, wanted);
        // One audio track plays; a subtitle track shows, or none for off.
        if (index !== -1 || (kind === 'subtitles' && wanted === null)) {
          tracks.forEach((track, at) => {
            if (kind === 'audio') track.enabled = at === index;
            else track.mode = at === index ? 'showing' : 'disabled';
          });
        }
      }
      this.put[kind] = this.nativeActive(player, kind);
    }
  }

  private noteNative(player: PlayerHost): void {
    if (this.engine !== null || this.loading) return;
    for (const kind of ['audio', 'subtitles'] as const) {
      const now = this.nativeActive(player, kind);
      if ((kind === 'audio' && now === null) || same(now, this.put[kind])) continue;
      this.put[kind] = now;
      this.save(kind, now as TrackChoice);
    }
  }
}
