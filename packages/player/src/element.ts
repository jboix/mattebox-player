/**
 * <mattebox-player>: a real <video> as a light-DOM child, so the integrator
 * can reach it, and the error surface in shadow DOM. The element never
 * forwards or wraps a media element member: play, pause, seek, volume and
 * the rest live on the video, where the browser, Picture-in-Picture and the
 * OS media session already find them.
 *
 * The controls are elements the page places inside, beside the video, and
 * the stage slots them over the picture. The element appends none of its
 * own: the composition is the page's in every mode, and `none` hides every
 * child but the video. The element reflects the video's state as
 * attributes on itself, `paused`, `playing`, `ended`, `muted`, `audio`,
 * `started` and `waiting`, for the page's stylesheet and the controls
 * alike.
 *
 * No class fields, `#private` or otherwise: the ES2015 build would lower
 * them into runtime helpers, and the emit check bans helpers. Statics are
 * getters and instance state is declared, then assigned in the constructor.
 */

import type {
  Connector,
  Handler,
  Player,
  PlayerError,
  Programme,
  ProgrammeSource,
  Session,
  Source,
  SourceVideoTrack,
} from '@mattebox/player-core';
import {
  createPlayer,
  inferType,
  matteboxHandler,
  nativeHandler,
  preferNativeHls,
} from '@mattebox/player-core';
import type { KernelConfig, Mattebox, Stage } from 'mattebox';
import type { AttachEmeOptions } from 'mattebox/eme';
import type { Announcer } from './announcer.js';
import { announcer } from './announcer.js';
import type { Marker, Markers } from './controls/markers.js';
import { createMarkers } from './controls/markers.js';
import { languageName } from './controls/track-names.js';
import type { Block, PlayerHost } from './host.js';
import type { LocaleSource } from './locales.js';
import { addLocale, load, onLocales, registered, wordsNow } from './locales.js';
import type { Messages, Words } from './messages.js';
import { namespaces } from './namespaces.js';
import { drmGuard, resolvePreset } from './presets.js';
import { STYLE } from './style.js';
import type { ErrorSurface } from './surface.js';
import { errorSurface } from './surface.js';
import { ERROR_SCREEN, PLAYER } from './tags.js';
import { textIn } from './text.js';
import type { Tracker, TrackerRunner, Trackers } from './trackers.js';
import { createTrackers } from './trackers.js';
import type { Chosen } from './video-sources.js';
import {
  chosen,
  holdFrame,
  markupVideoTracks,
  onNextFrame,
  restore,
  resume,
  versionSource,
} from './video-sources.js';

/**
 * `off` keeps HLS on the engine in Safari. Anything else lets Safari play
 * HLS itself: FairPlay, AirPlay, Low-Latency HLS and the platform's
 * fullscreen then work as Apple built them. Changing it reloads.
 */
const NATIVE_HLS = 'native-hls';

/** Attributes forwarded onto the video as attributes, never as properties. */
const FORWARDED = ['autoplay', 'muted', 'poster', 'crossorigin'];

const LICENSE_URL = 'license-url';

/** The language the page chose, over the nearest `lang`. */
const LANGUAGE = 'language';

/** Carried through a switch: the play state from before it, `playing` or `paused`. */
const SWITCHING = 'switching';

/** Whether the browser has EME, so a source may bring DRM. */
function emeAvailable(): boolean {
  return drmGuard().without === undefined;
}

/** `source` without its DRM, for a browser without EME. */
function withoutDrm({ url, type, videoTracks }: Source): Source {
  return {
    url,
    ...(type === undefined ? {} : { type }),
    ...(videoTracks === undefined ? {} : { videoTracks }),
  };
}
const CERTIFICATE_URL = 'certificate-url';

/** Everything else the element watches. Changing any of them reloads. */
const OWN = ['src', 'type', 'preset', LICENSE_URL, CERTIFICATE_URL, 'thumbnails', NATIVE_HLS];

/**
 * The chapters file URL. A session with the engine's `chapters` namespace
 * loads it there: through the engine's transport, so request hooks apply,
 * and in every format the engine reads. Any other session gets a
 * `<track kind="chapters">` on the video, hidden so its cues load and
 * nothing is drawn. The seek bar and the chapters menu read either.
 * Changing it never reloads the source.
 */
const CHAPTERS = 'chapters';

/**
 * The one attribute whose meaning the element owns: `native` keeps the
 * browser's controls on the video, `custom` swaps them for the controls the
 * page placed inside, `none` takes the browser's off and hides every child
 * but the video. Anything else is `native`. Changing it never touches the
 * session.
 */
const CONTROLS = 'controls';

/**
 * Inline playback, on until the page writes `playsinline="false"`, the way
 * `spellcheck` and `draggable` are on until told otherwise. An iPhone takes
 * a video without `playsinline` to its own fullscreen on play, where no
 * control the page placed shows. Changing it never reloads.
 */
const PLAYSINLINE = 'playsinline';

/**
 * The size tier the controls draw for: `compact` on a small player, such
 * as a phone held upright, `wide` on a large one, such as a TV or
 * fullscreen, and `regular` between. The element measures itself and sets
 * the attribute, so a stylesheet matches `mattebox-player[layout="compact"]`.
 * A page that writes one of the three values fixes it, and removing the
 * attribute hands it back. The player's own box decides, not the screen:
 * a small embed on a desktop is compact, and a phone in fullscreen is not.
 */
const LAYOUT = 'layout';
const LAYOUTS = ['compact', 'regular', 'wide'];
/** Under either, the player is compact. */
const COMPACT_WIDTH = 480;
const COMPACT_HEIGHT = 320;
/** From both, the player is wide. */
const WIDE_WIDTH = 1280;
const WIDE_HEIGHT = 700;

/** The video's state, as attributes on the element, read on the events the video fires for it. */
const STATE_EVENTS = [
  'play',
  'pause',
  'ended',
  // A seek back from the end leaves `ended` with no play, pause or ended event.
  'seeked',
  'emptied',
  'volumechange',
  'loadedmetadata',
  'resize',
  'playing',
  'waiting',
  'stalled',
  'canplay',
];

/**
 * How long the video waits for data before the live region says so. A
 * seek within the buffer waits for less, and saying it would only be noise.
 */
const LOADING_MS = 1000;

/** A track's name for the live region: its name in the stream, else its language's in `locale`. */
function trackName(name: string | undefined, lang: string | undefined, locale: string): string {
  return name || (lang && (languageName(lang, locale || undefined) ?? lang)) || '';
}

/** The stages that register a key system, which a native session's DRM offers. */
const KEY_SYSTEMS = ['eme-fairplay', 'eme-cenc'];

/** Every stage the engine ships. A narrower preset is optimization. */
const DEFAULT_PRESET = 'full';

/**
 * What the element dispatches. `error` is also a standard DOM event name, so
 * without these overloads a listener on it is typed as `ErrorEvent` and the
 * payload needs a double cast. They are declarations only: no runtime bytes.
 */
export interface MatteboxPlayerEventMap {
  sourcechange: CustomEvent<Session | null>;
  /** The size tier changed: `compact`, `regular` or `wide`. */
  layoutchange: CustomEvent<string>;
  error: CustomEvent<PlayerError>;
  /** The markers changed: set by the page, or cleared by a new source. */
  markerschange: CustomEvent<readonly Marker[]>;
  /** Playback reached a blocked range and moved past it. */
  blocked: CustomEvent<Marker>;
  /** The page called `block()` or `unblock()`, or a new source cleared the block: the block, or null. */
  blockchange: CustomEvent<Block | null>;
  /** A load resolved what it plays, before the session: the programme, or null at unload. */
  programmechange: CustomEvent<Programme | null>;
  /** A tracker was added, removed, started or stopped: the trackers. */
  trackerschange: CustomEvent<readonly Tracker[]>;
}

export interface MatteboxPlayerElement {
  addEventListener<K extends keyof MatteboxPlayerEventMap>(
    type: K,
    listener: (this: MatteboxPlayerElement, event: MatteboxPlayerEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<K extends keyof MatteboxPlayerEventMap>(
    type: K,
    listener: (this: MatteboxPlayerElement, event: MatteboxPlayerEventMap[K]) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}

export interface MatteboxPlayerOptions {
  /** The whole chain, in order. Takes precedence over `stages` and the `preset` attribute. */
  readonly handlers?: readonly Handler[];
  /** Stages for the mattebox handler. Takes precedence over the `preset` attribute. */
  readonly stages?: readonly Stage[];
  /**
   * Kernel tuning for the engines the elements build, `traceCapacity` among
   * it. A page decision, like the stages, so not an attribute. Ignored with
   * `handlers`, which carry their own.
   */
  readonly config?: Partial<KernelConfig>;
  /**
   * DRM for a native session, as `attachEme` from `mattebox/eme` takes it:
   * `keySystems`, `licenseUrl`, `licenseUrls`, `requestHook`. Without
   * `keySystems` the session offers the key-system stages of the engine's
   * stack. The `license-url` attribute overrides `licenseUrl`, and
   * `certificate-url` gives the FairPlay certificate. Ignored
   * with `handlers`, which carry their own.
   */
  readonly drm?: AttachEmeOptions;
  /**
   * One per source type, such as `srgssr/urn`: a source of that type is a
   * programme id, or data you give, which the connector resolves to what
   * plays. Kept with `handlers`.
   */
  readonly connectors?: readonly Connector[];
}

/**
 * What `define()` recorded, for the elements the parser creates. It is the
 * one value shared across elements, because a page that writes only markup
 * still has to be able to say what the engine carries.
 */
let defaults: MatteboxPlayerOptions = {};

/**
 * The interface above merges only `addEventListener` and `removeEventListener`
 * overloads, which the class inherits from HTMLElement. The rule it suppresses
 * guards against properties an interface declares and a constructor never
 * assigns, and there are none.
 */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: method overloads only, no properties
export class MatteboxPlayerElement extends HTMLElement implements PlayerHost {
  static get observedAttributes(): readonly string[] {
    return [...FORWARDED, ...OWN, CONTROLS, CHAPTERS, PLAYSINLINE, LAYOUT, LANGUAGE, 'lang'];
  }

  /**
   * Registers the words of a language for every player on the page. Each
   * source is a set of words or a function that loads one, which runs only
   * when a player shows that language. Later sources go over earlier ones,
   * so a page changes a shipped word by registering its own after it.
   * Players that show the language take the new words at once.
   */
  static addLocale(language: string, ...sources: readonly LocaleSource[]): void {
    addLocale(language, sources);
  }

  /**
   * Registers the element once, and records the stages markup-only pages
   * get. The controls register through their own entries, the package's
   * root entry importing every one; a control connected before its player
   * is defined waits for the definition.
   */
  static define(options?: MatteboxPlayerOptions): void {
    if (options !== undefined) defaults = options;
    if (customElements.get(PLAYER) === undefined) {
      customElements.define(PLAYER, MatteboxPlayerElement);
    }
  }

  declare private readonly media: HTMLVideoElement;
  /** Wraps the slot: the picture, and the controls over it or under it. */
  declare private readonly stage: HTMLDivElement;
  /** Whether the element gave itself a tabindex for the bar, to take back with it. */
  declare private focusable: boolean;
  declare private readonly surface: ErrorSurface;
  declare private readonly voice: Announcer;
  /** The words of the language shown, empty for English. */
  declare private words: Words;
  /** The language tag the player resolved, or empty without one. */
  declare private shown: string;
  /** Bumped on every resolution, so a slow loader does not win over a later choice. */
  declare private wordsEpoch: number;
  /** Ends the watch on registrations and on the page's `lang`. */
  declare private unwatch: (() => void) | null;
  /** Runs out when the video has waited `LOADING_MS`. */
  declare private slow: ReturnType<typeof setTimeout> | undefined;
  /** The audio track the live region last saw, so it says only a change. Undefined before the first play. */
  declare private heardAudio: string | undefined;
  /** The subtitle track it last saw: null for off, undefined before the first play. */
  declare private heardText: string | null | undefined;
  /** Stops listening to the current engine's track selection. */
  declare private offTracks: (() => void) | null;
  declare private readonly marks: Markers;
  /** The chapters track element, while the `chapters` attribute names one and the engine takes none. */
  declare private track: HTMLTrackElement | null;
  /** The chapters URL the current session's engine was given, or null. */
  declare private given: string | null;
  /** The sources the page set from script, or null. */
  declare private list: readonly ProgrammeSource[] | null;
  declare private readonly tracking: TrackerRunner;
  /** The sources of the last run, as text: what tells a new `<source>` child from the ones already tried. */
  declare private tried: string;
  /** The options this element was constructed with, or null for the ones `define()` recorded. */
  declare private readonly own: MatteboxPlayerOptions | null;
  declare private core: Player | null;
  declare private current: Session | null;
  declare private failure: PlayerError | null;
  /** What `block()` set, or null. */
  declare private stop: Block | null;
  /** Whether an attribute change is the element's own reflection, which must not write back to the video. */
  declare private reflecting: boolean;
  /** Watches the element's box for `layout`, while connected. */
  declare private sizes: ResizeObserver | null;
  /** Whether the page wrote `layout`, so the element leaves it alone. */
  declare private fixed: boolean;
  /** The video has played once since its source was set: `started`, which tells a first play from a pause. */
  declare private started: boolean;
  /** The video waits for data: `waiting`, set on `waiting` and `stalled`, cleared once it can play. */
  declare private waiting: boolean;
  declare private offs: Array<() => void>;
  /** Everything the element does to the player runs here, so it runs in order. */
  declare private queue: Promise<void>;
  /** Whether a run is queued and not yet started, so a burst of changes loads once. */
  declare private pending: boolean;
  /** The source the versions of `videoSources` belong to: the one that played before a switch. */
  declare private original: Source | null;
  /** The version that plays, or null for the programme itself. */
  declare private version: SourceVideoTrack | null;
  /** True while a version loads, so its `sourcechange` keeps the programme. */
  declare private switching: boolean;
  /** The source `switchSource` loaded, which a retry loads again, or null. */
  declare private switched: Source | null;
  /** Ends the hold of a switch: the poster and `switching` go back. Null without one. */
  declare private held: (() => void) | null;

  constructor(options?: MatteboxPlayerOptions) {
    super();
    this.own = options ?? null;
    this.focusable = false;
    this.track = null;
    this.given = null;
    this.list = null;
    this.tried = '';
    this.core = null;
    this.current = null;
    this.failure = null;
    this.stop = null;
    this.reflecting = false;
    this.sizes = null;
    this.fixed = false;
    this.started = false;
    this.waiting = false;
    this.offs = [];
    this.queue = Promise.resolve();
    this.pending = false;
    this.original = null;
    this.version = null;
    this.switching = false;
    this.switched = null;
    this.held = null;
    this.words = {};
    this.shown = '';
    this.wordsEpoch = 0;
    this.unwatch = null;
    this.slow = undefined;
    this.heardAudio = undefined;
    this.heardText = undefined;
    this.offTracks = null;

    this.media = document.createElement('video');
    // Native until the `controls` attribute says otherwise, which arrives
    // through attributeChangedCallback: a constructor must not read attributes.
    this.media.controls = true;
    // Inline is the default, and the player's own attribute has not arrived
    // yet. Set as an attribute: not every browser has the `playsInline`
    // property. The fullscreen button still reaches the iPhone's fullscreen,
    // through `webkitEnterFullscreen`.
    this.media.setAttribute(PLAYSINLINE, '');
    for (const name of STATE_EVENTS) {
      this.media.addEventListener(name, () => {
        const was = this.waiting;
        this.note(name);
        this.reflect();
        this.tell(name, was);
      });
    }
    // A native session's tracks; an engine session's are on `tracks:selected`.
    const lists = this.media as { audioTracks?: EventTarget; textTracks: EventTarget };
    for (const list of [lists.audioTracks, lists.textTracks]) {
      list?.addEventListener('change', () => {
        this.tracks();
      });
    }
    // An error over a picture that then plays is wrong by definition.
    this.media.addEventListener('playing', () => {
      this.failure = null;
    });
    this.marks = createMarkers(this.media, (name, detail) => this.emit(name, detail));
    this.tracking = createTrackers(this, () => this.emit('trackerschange', this.tracking.list));
    this.stage = document.createElement('div');
    this.stage.setAttribute('part', 'stage');
    const slot = document.createElement('slot');
    // The parser connects the element before its children exist, so the
    // first run finds no `<source>`. A video starts its selection when a
    // `<source>` arrives and nothing is loaded, and so does this.
    slot.addEventListener('slotchange', () => {
      if (this.current === null && JSON.stringify(this.wanted()) !== this.tried) this.reload();
    });
    this.stage.append(slot);
    this.surface = errorSurface(
      () => {
        this.retry();
      },
      () => this.words.retry ?? 'Retry',
    );

    this.voice = announcer(this, (id) => this.words[id]);

    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLE;
    root.append(style, this.stage, this.surface.root, this.voice.root);
  }

  /** The media element. Everything the browser already does is here. */
  get video(): HTMLVideoElement {
    return this.media;
  }

  /** The ranges the page named in this source: credits to skip, parts that must not play. */
  get markers(): Markers {
    return this.marks;
  }

  /**
   * The sources to try in order, set from script. The `src` attribute wins
   * over them, and they win over the `<source>` children. Setting them
   * loads, and null returns to the children.
   */
  get sources(): readonly ProgrammeSource[] | null {
    return this.list;
  }

  set sources(value: readonly ProgrammeSource[] | null) {
    this.list = value;
    // Markers and a block belong to a source, as for `src`.
    if (this.marks.list.length > 0) this.marks.set([]);
    this.unblock();
    this.reload();
  }

  /**
   * The language the page chose for this player, which wins over the
   * nearest `lang` attribute. Empty follows `lang`. Setting it changes the
   * words of every control at once.
   */
  get language(): string {
    return this.getAttribute(LANGUAGE) ?? '';
  }

  set language(value: string) {
    if (value === '') this.removeAttribute(LANGUAGE);
    else this.setAttribute(LANGUAGE, value);
  }

  /** The language tag the words come from: `language`, else the nearest `lang`. Empty without either. */
  get locale(): string {
    return this.shown;
  }

  /** The word of `id` in the player's language, or undefined, where the control's English applies. */
  message(id: keyof Messages): string | undefined {
    return this.words[id];
  }

  /** Follows registrations and the document's `lang` until disconnect. */
  private watchLanguage(): void {
    const off = onLocales(() => {
      this.relocale();
    });
    // The page's language usually sits on <html>; a lang on another
    // ancestor is read at connect, and `language` covers a change there.
    const watch = new MutationObserver(() => {
      this.relocale();
    });
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    this.unwatch = () => {
      off();
      watch.disconnect();
    };
    this.relocale();
  }

  /** Resolves the language, takes its words, and tells the controls with `localechange`. */
  private relocale(): void {
    const tag = this.getAttribute(LANGUAGE) ?? this.closest('[lang]')?.getAttribute('lang') ?? '';
    const epoch = ++this.wordsEpoch;
    const take = (words: Words): void => {
      if (epoch !== this.wordsEpoch) return;
      this.shown = tag;
      this.words = words;
      this.showBlock();
      this.emit('localechange', tag);
    };
    const key = registered(tag);
    if (key === null) {
      take({});
      return;
    }
    const now = wordsNow(key);
    if (now !== null) {
      take(now);
      return;
    }
    // The words on screen stay until the language arrives; a loader that
    // fails leaves them.
    load(key).then(take, () => undefined);
  }

  /**
   * Loads the sources again, in the order a load reads them: the `src`
   * attribute, the `sources` property, then the `<source>` children. The
   * error screens' Retry calls it. On a version of `videoSources`, it
   * loads that version again.
   */
  retry(): void {
    const again =
      this.version === null ? this.switched : versionSource(this.version, emeAvailable());
    if (again === null) this.reload();
    else this.swap(again, null, false, null, false);
  }

  /**
   * Loads `source` in place of the one that plays, from the same position
   * and in the same play state, with the same audio and subtitle choice.
   * Use it for the same programme at another URL, such as its HLS and
   * DASH manifests. The last frame and the controls hold until the new
   * load shows a frame there. The markers stay, and the versions are the
   * ones `source` names. A new `src`, `sources` or `<source>` load
   * replaces it.
   */
  switchSource(source: Source): void {
    const media = this.media;
    const at = Number.isFinite(media.duration) ? media.currentTime : null;
    const playing = !media.paused;
    const had = chosen(this.current?.engine ?? null);
    const clean = emeAvailable() ? source : withoutDrm(source);
    const was = this.version;
    this.original = clean;
    this.switched = clean;
    this.version = null;
    if (was !== null) this.emit('videosourcechange', null);
    this.swap(clean, at, playing, had, true);
  }

  /** The other versions of the picture the source names at their own URLs, for the video menu. */
  get videoSources(): readonly SourceVideoTrack[] {
    return this.original?.videoTracks ?? [];
  }

  /** The version of `videoSources` that plays, or null for the source itself. */
  get videoSource(): SourceVideoTrack | null {
    return this.version;
  }

  /**
   * Plays a version of `videoSources`, or the source itself for null, from
   * the same position and in the same play state, with the same audio and
   * subtitle choice. A live source joins the version at its live edge.
   * Fires `videosourcechange`.
   */
  selectVideoSource(track: SourceVideoTrack | null): void {
    const programme = this.original;
    if (programme === null || track === this.version) return;
    if (track !== null && programme.videoTracks?.includes(track) !== true) return;
    const media = this.media;
    const at = Number.isFinite(media.duration) ? media.currentTime : null;
    const playing = !media.paused;
    const had = chosen(this.current?.engine ?? null);
    this.version = track;
    this.emit('videosourcechange', track);
    this.swap(
      track === null ? programme : versionSource(track, emeAvailable()),
      at,
      playing,
      had,
      true,
    );
  }

  /**
   * Loads `source` under the programme that plays, and puts the position,
   * play state and tracks back. With `hold`, the last frame stays as the
   * poster and the player carries `switching`, the play state from
   * before, so the controls show that state through the load.
   */
  private swap(
    source: Source,
    at: number | null,
    playing: boolean,
    had: Chosen | null,
    hold: boolean,
  ): void {
    const media = this.media;
    this.held?.();
    let release: (() => void) | null = null;
    if (hold) {
      // Taken now, while the frame of the source that played is still on screen.
      const frame = holdFrame(media);
      const done = (): void => {
        frame?.();
        if (this.held !== done) return;
        this.held = null;
        this.removeAttribute(SWITCHING);
        this.reflect();
      };
      this.held = done;
      this.setAttribute(SWITCHING, playing ? 'playing' : 'paused');
      release = done;
    }
    this.enqueue(async () => {
      const core = await this.ensure();
      this.switching = true;
      try {
        await core.load([source]);
      } catch {
        // Reported on the error event, as for any load.
        release?.();
        return;
      } finally {
        this.switching = false;
      }
      resume(media, at, playing);
      if (release !== null) onNextFrame(media, at, release);
      restore(this.current?.engine ?? null, had);
    });
  }

  /** The core, or null until the first source has been set up: resolving a preset is asynchronous. */
  get player(): Player | null {
    return this.core;
  }

  /** The engine feeding the video, or null for a native session and before the first load. */
  get engine(): Mattebox | null {
    return this.current?.engine ?? null;
  }

  /**
   * The fatal error of the current load, or null once a load starts or
   * playback resumes. The `error` event says when; this says what, for a
   * control that attaches after the event, such as an error screen parsed
   * after a source that failed while the page was still loading.
   */
  get error(): PlayerError | null {
    return this.failure;
  }

  /**
   * Shows why the programme does not play, in place of the video, and
   * stops the load: the reason the page's content API gave, such as a
   * geographic or an age restriction. The error screen shows the title,
   * else "Not available", and the message, with no retry. Each text can
   * be given by language tag, and follows the player's language. A new
   * `src` or `sources` clears it. Fires `blockchange`.
   */
  block(block: Block): void {
    this.refuse(block);
    this.enqueue(() => this.teardown());
  }

  /** Shows the block, for `block()` and for a programme a connector blocked, which loaded nothing. */
  private refuse(block: Block): void {
    this.stop = block;
    this.media.pause();
    clearTimeout(this.slow);
    const [title, message] = this.blockWords(block);
    // An error screen in the player is an alert of its own, read already.
    if (this.querySelector(ERROR_SCREEN) === null) {
      this.voice.tell(message === '' ? title : `${title}. ${message}`);
    }
    this.showBlock();
    this.emit('blockchange', block);
  }

  /** Removes the block. Nothing plays until a source loads: set one, or call `retry()`. */
  unblock(): void {
    if (this.stop === null) return;
    this.stop = null;
    this.surface.clear();
    this.emit('blockchange', null);
  }

  /** What `block()` set, or null. */
  get blocked(): Block | null {
    return this.stop;
  }

  /**
   * What the current load resolved to: the sources, and what a connector
   * said of the programme. Null before a load and after an unload.
   */
  get programme(): Programme | null {
    return this.core?.programme ?? null;
  }

  /**
   * The page's trackers. Each starts at every programme and stops at its
   * end; one added or removed during a programme starts or stops at once.
   */
  get trackers(): Trackers {
    return this.tracking;
  }

  /**
   * Applies what the load resolved, before any session: the markers, the
   * poster, the block. The page's own `poster` and markers set after the
   * source win. Then the trackers start on the programme.
   */
  private programmed(programme: Programme | null): void {
    const metadata = programme?.metadata;
    if (metadata?.markers !== undefined) this.marks.set(metadata.markers);
    if (!this.hasAttribute('poster')) {
      if (metadata?.poster === undefined) this.media.removeAttribute('poster');
      else this.media.poster = metadata.poster;
    }
    if (programme?.block !== undefined) this.refuse(programme.block);
    this.emit('programmechange', programme);
    this.tracking.begin(programme);
  }

  /** A block's title and message in the player's language: the title defaults to the `blocked` word. */
  private blockWords(block: Block): [string, string] {
    return [
      block.title === undefined
        ? (this.words.blocked ?? 'Not available')
        : textIn(block.title, this.shown),
      block.message === undefined ? '' : textIn(block.message, this.shown),
    ];
  }

  /** Puts the block on the row under the video, under native controls. */
  private showBlock(): void {
    if (this.stop === null || this.getAttribute(CONTROLS) === 'custom') return;
    const [title, message] = this.blockWords(this.stop);
    this.surface.inform(title, message);
  }

  connectedCallback(): void {
    if (this.media.parentNode !== this) this.append(this.media);
    for (const name of FORWARDED) this.forward(name);
    this.reflect();
    if (typeof ResizeObserver !== 'undefined') {
      this.sizes = new ResizeObserver(() => {
        this.measure();
      });
      this.sizes.observe(this);
    }
    this.measure();
    this.watchLanguage();
    this.reload();
  }

  /** Sets `layout` from the element's box, unless the page fixed it. */
  private measure(): void {
    if (this.fixed) return;
    const width = this.clientWidth;
    const height = this.clientHeight;
    // Not laid out yet: no tier until there is a box to judge.
    if (width === 0 || height === 0) return;
    const layout =
      width < COMPACT_WIDTH || height < COMPACT_HEIGHT
        ? 'compact'
        : width >= WIDE_WIDTH && height >= WIDE_HEIGHT
          ? 'wide'
          : 'regular';
    if (this.getAttribute(LAYOUT) === layout) return;
    this.reflecting = true;
    this.setAttribute(LAYOUT, layout);
    this.reflecting = false;
    this.emit('layoutchange', layout);
  }

  /** The two states the video does not hold: whether it has played once, and whether it waits for data. */
  private note(event: string): void {
    if (event === 'playing') {
      // The tracks the video starts playing with are what a change is from.
      if (!this.started) this.tracks();
      this.started = true;
      this.waiting = false;
    } else if (event === 'waiting' || event === 'stalled') {
      this.waiting = true;
    } else if (event === 'canplay') {
      this.waiting = false;
    } else if (event === 'emptied') {
      // A new source starts over: the title shows again before its first play.
      // A switch is the same programme, so it keeps its start.
      if (this.held === null) this.started = false;
      this.waiting = false;
      this.heardAudio = undefined;
      this.heardText = undefined;
    }
  }

  /** Says a play or a pause, and a wait once it has lasted `LOADING_MS`. */
  private tell(event: string, was: boolean): void {
    // The load of a switch pauses and plays the video, and the viewer did neither.
    if (event === 'play' && this.held === null) this.voice.say('playing', 'saidPlaying', 'Playing');
    // The end of the video pauses it too, and that is no pause to say.
    if (event === 'pause' && !this.media.ended && this.held === null) {
      this.voice.say('paused', 'saidPaused', 'Paused');
    }
    if (this.waiting === was) return;
    clearTimeout(this.slow);
    if (this.waiting) {
      this.slow = setTimeout(() => {
        this.voice.say('loading', 'loading', 'Loading');
      }, LOADING_MS);
    }
  }

  /**
   * Says a change of the audio or the subtitle track, once the video has
   * played: the tracks a load starts with are no change. A forced track
   * reads as off, as in the subtitles menu.
   */
  private tracks(): void {
    const engine = this.current?.engine ?? null;
    let audio: string;
    let text: string | null;
    if (engine !== null) {
      const sound = engine.tracks.active('audio');
      const words = engine.tracks.active('text');
      audio = sound === null ? '' : trackName(sound.name, sound.lang, this.locale);
      text =
        words === null || words.forced === true
          ? null
          : trackName(words.name, words.lang, this.locale);
    } else {
      const video = this.media as {
        audioTracks?: ArrayLike<{ enabled: boolean; label: string; language: string }>;
      };
      const sound = Array.from(video.audioTracks ?? []).find((track) => track.enabled);
      const words = Array.from(this.media.textTracks).find(
        (track) =>
          (track.kind === 'subtitles' || track.kind === 'captions') && track.mode === 'showing',
      );
      audio = sound === undefined ? '' : trackName(sound.label, sound.language, this.locale);
      text = words === undefined ? null : trackName(words.label, words.language, this.locale);
    }
    const { heardAudio, heardText } = this;
    this.heardAudio = audio;
    this.heardText = text;
    if (!this.started) return;
    if (heardAudio !== undefined && audio !== heardAudio) {
      this.voice.say('audio', 'saidAudio', 'Audio: {track}', audio);
    }
    if (heardText !== undefined && text !== heardText) {
      if (text === null) this.voice.say('subtitles-off', 'saidSubtitlesOff', 'Subtitles off');
      else this.voice.say('subtitles', 'saidSubtitles', 'Subtitles: {track}', text);
    }
  }

  /** The video's state on the element, for `mattebox-player[paused]` and the like. */
  private reflect(): void {
    const video = this.media;
    this.reflecting = true;
    // Through a switch, the play state from before it.
    const held = this.getAttribute(SWITCHING);
    const paused = held === null ? video.paused : held === 'paused';
    this.toggleAttribute('paused', paused);
    this.toggleAttribute('playing', !paused);
    this.toggleAttribute('ended', video.ended);
    // `muted` is also forwarded: the page's attribute sets the video, and
    // the video's state sets the attribute. Reflection never forwards, so
    // a read can only ever change the attribute, never the video.
    this.toggleAttribute('muted', video.muted);
    this.toggleAttribute('audio', this.audio());
    this.toggleAttribute('started', this.started);
    this.toggleAttribute('waiting', this.waiting);
    this.reflecting = false;
  }

  /**
   * Whether the source has no picture. Once the metadata is in, the video's
   * size decides: zero by zero is sound alone, and `resize` catches a stream
   * that moves to or from an audio-only rendition. Before that, the type the
   * page wrote or the URL implies is the hint, so an mp3 is `audio` from
   * the start rather than from its metadata.
   */
  private audio(): boolean {
    const video = this.media;
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      return video.videoWidth === 0 && video.videoHeight === 0;
    }
    const src = this.getAttribute('src');
    const type = this.getAttribute('type') ?? (src === null ? undefined : inferType(src));
    return type?.startsWith('audio/') === true;
  }

  disconnectedCallback(): void {
    this.sizes?.disconnect();
    this.sizes = null;
    this.unwatch?.();
    this.unwatch = null;
    // A single-page app must not leave a pipeline attached to a video it
    // navigated away from. Reconnecting loads the `src` again.
    this.enqueue(() => this.teardown());
  }

  attributeChangedCallback(name: string): void {
    if (name === LANGUAGE || name === 'lang') {
      this.relocale();
      return;
    }
    if (FORWARDED.includes(name)) {
      if (!this.reflecting) this.forward(name);
      return;
    }
    if (name === CONTROLS) {
      this.mode();
      return;
    }
    if (name === CHAPTERS) {
      this.chapters();
      return;
    }
    if (name === LAYOUT) {
      // The element's own write is not the page's.
      if (this.reflecting) return;
      const value = this.getAttribute(LAYOUT);
      this.fixed = value !== null && LAYOUTS.includes(value);
      if (this.fixed) this.emit('layoutchange', value);
      else this.measure();
      return;
    }
    if (name === PLAYSINLINE) {
      // On the video it is a boolean attribute, so off is absent.
      this.media.toggleAttribute(PLAYSINLINE, this.getAttribute(PLAYSINLINE) !== 'false');
      return;
    }
    // The preset decides the chain, so it is the one attribute that rebuilds it.
    if (name === 'preset') this.enqueue(() => this.discard());
    // The source's type is the hint for `audio` until its metadata arrives.
    // Only `audio`: a full reflection here would drop a `muted` the page
    // wrote before its own callback forwards it.
    if (name === 'src' || name === 'type') this.toggleAttribute('audio', this.audio());
    // Markers belong to a source. Cleared here, not on `emptied`, which
    // arrives later and would clear the ones the page sets right after.
    if (name === 'src' && this.marks.list.length > 0) this.marks.set([]);
    if (name === 'src') this.unblock();
    this.reload();
  }

  /**
   * Applies the `controls` attribute: the video's own controls and the
   * tabindex. The controls themselves are elements the page placed, and
   * they attach on their own; the element appends none.
   */
  private mode(): void {
    const value = this.getAttribute(CONTROLS);
    const custom = value === 'custom';
    this.media.controls = !custom && value !== 'none';
    // Under custom controls the error screen element carries a fatal error.
    if (custom) this.surface.clear();
    else this.showBlock();
    if (!custom) {
      if (this.focusable) this.removeAttribute('tabindex');
      this.focusable = false;
    } else if (!this.hasAttribute('tabindex')) {
      // A bare video is not focusable, so without this a click on it would
      // leave the shortcuts nowhere to listen. A page that set its own
      // tabindex keeps it.
      this.tabIndex = 0;
      this.focusable = true;
    }
  }

  /** Hands the `chapters` attribute to the engine, or keeps a hidden chapters track on the video for it. */
  private chapters(): void {
    const url = this.getAttribute(CHAPTERS);
    const engine = this.current?.engine ?? null;
    const api = engine === null ? undefined : namespaces(engine).chapters;
    if (api !== undefined) {
      this.track?.remove();
      this.track = null;
      if (url === this.given) return;
      this.given = url;
      // An empty list removes the chapters the attribute loaded.
      if (url === null) api.set([]);
      else void api.load(url).catch(() => undefined);
      return;
    }
    if (url === null) {
      this.track?.remove();
      this.track = null;
      return;
    }
    const held = this.track;
    if (held !== null && held.parentNode === this.media && held.getAttribute('src') === url) return;
    // A new element each time: one removed mid-load, as the engine's attach
    // does, stays in its error state, and neither a new `src` nor a second
    // insertion starts it loading again.
    held?.remove();
    const track = document.createElement('track');
    track.kind = 'chapters';
    track.src = url;
    this.track = track;
    this.media.append(track);
    // Set after the insertion: a track element's mode exists once it is in
    // a media element, and `hidden` is what makes its cues load unseen.
    track.track.mode = 'hidden';
  }

  private forward(name: string): void {
    const value = this.getAttribute(name);
    if (value === null) this.media.removeAttribute(name);
    else this.media.setAttribute(name, value);
    // A video reads `muted` into its state only when it is created, and this
    // one was created before any attribute reached it. Muted autoplay and
    // the autoplay policy read the state, so the attribute alone would not do.
    if (name === 'muted') this.media.muted = value !== null;
  }

  private enqueue(task: () => Promise<void>): void {
    this.queue = this.queue.then(task, task).catch(() => undefined);
  }

  /**
   * One run per burst. The parser sets every attribute and then connects the
   * element before any queued task starts, and each of those would load on
   * its own; the flag folds them into the one run that sees the final state.
   */
  private reload(): void {
    if (this.pending) return;
    this.pending = true;
    this.enqueue(() => {
      this.pending = false;
      return this.run();
    });
  }

  private emit(name: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private report(error: PlayerError): void {
    if (error.fatal) {
      this.failure = error;
      clearTimeout(this.slow);
      // An error screen in the player is an alert of its own, read already.
      if (this.querySelector(ERROR_SCREEN) === null) {
        this.voice.say('error', 'playbackFailed', 'Playback failed');
      }
      // Under custom controls the error screen element is the surface, and
      // the element's own row under the video stays quiet.
      if (this.getAttribute(CONTROLS) !== 'custom') this.surface.show(error);
    }
    this.emit('error', error);
  }

  private async run(): Promise<void> {
    this.unmount();
    if (!this.isConnected) return;
    const sources = this.wanted();
    this.tried = JSON.stringify(sources);
    if (sources.length === 0) return;

    const core = await this.ensure();
    this.failure = null;
    this.surface.clear();

    try {
      await core.load(sources);
    } catch {
      // The core already reported it on the error event, which the surface
      // and the element's own event both carry. Nothing to add here.
      return;
    }
    if (!this.isConnected) await core.unload();
  }

  /**
   * What to load, ranked as a video ranks them: the `src` attribute, then
   * the `sources` property, then the `<source>` children in their order.
   * A child carries its own `license-url` and `certificate-url`.
   */
  private wanted(): readonly ProgrammeSource[] {
    // The `<mbx-video-track>` children are versions of the `src` or `<source>` picture.
    const versions = markupVideoTracks(this);
    const withVersions = versions.length === 0 ? {} : { videoTracks: versions };
    const url = this.getAttribute('src');
    if (url !== null) {
      const type = this.getAttribute('type');
      return [{ url, ...(type === null ? {} : { type }), ...withVersions }];
    }
    // A browser without EME gets no DRM stage, and a source must not bring DRM back.
    const eme = emeAvailable();
    if (this.list !== null) {
      return eme
        ? this.list
        : this.list.map((source) => ('url' in source ? withoutDrm(source) : source));
    }
    const found: Source[] = [];
    for (const child of Array.from(this.children)) {
      const src = child.localName === 'source' ? child.getAttribute('src') : null;
      if (src === null) continue;
      const type = child.getAttribute('type');
      const license = child.getAttribute(LICENSE_URL);
      const certificate = child.getAttribute(CERTIFICATE_URL);
      found.push({
        url: src,
        ...(type === null ? {} : { type }),
        ...withVersions,
        ...(!eme || (license === null && certificate === null)
          ? {}
          : {
              drm: {
                ...(license === null ? {} : { licenseUrl: license }),
                ...(certificate === null ? {} : { certificateUrl: certificate }),
              },
            }),
      });
    }
    return found;
  }

  /** Sets a session up. It runs for every session, the one that replaces a failed source included. */
  private adopt(session: Session): void {
    this.given = null;
    this.configure(session);
    // A content API's chapters, unless the `chapters` attribute names a file.
    const chapters = this.core?.programme?.metadata?.chapters;
    if (chapters !== undefined && session.engine !== null && this.getAttribute(CHAPTERS) === null) {
      namespaces(session.engine).chapters?.set(chapters);
    }
    // The engine's attach empties the media element to reset its resource
    // selection (`kernel/mse.ts`), and the chapters track goes with the
    // `<source>` children it means. Wanted: the track to survive attach.
    // Had to: put it back once the session is in. The surface that would
    // make it one call: an attach that removes `<source>` children alone.
    // A session with the engine's chapters takes the URL there instead.
    this.chapters();
  }

  private async ensure(): Promise<Player> {
    if (this.core !== null) return this.core;
    const connectors = this.options.connectors;
    const core = createPlayer(this.media, {
      handlers: await this.chain(),
      ...(connectors === undefined ? {} : { connectors }),
    });
    this.offs.push(
      core.on('programme', (programme) => {
        this.programmed(programme);
      }),
      core.on('sourcechange', (session) => {
        // Before the event goes out, so a control that reads `engine` on
        // `sourcechange` sees the session the event is about.
        this.current = session;
        // A version loads under the programme it belongs to; any other load is a programme of its own.
        if (!this.switching) {
          const was = this.version;
          this.original = session?.source ?? null;
          this.switched = null;
          this.version = null;
          this.held?.();
          if (was !== null) this.emit('videosourcechange', null);
        }
        this.offTracks?.();
        this.offTracks = session?.engine?.on('tracks:selected', () => this.tracks()) ?? null;
        if (session !== null && this.isConnected) this.adopt(session);
        this.emit('sourcechange', session);
      }),
      core.on('error', (error) => {
        this.report(error);
      }),
    );
    this.core = core;
    return core;
  }

  /**
   * Read at each use, not once in the constructor. Importing the package
   * registers the element, and the parser's elements are constructed then,
   * before the page's own `define()` call can run.
   */
  private get options(): MatteboxPlayerOptions {
    return this.own ?? defaults;
  }

  private async chain(): Promise<readonly Handler[]> {
    if (this.options.handlers !== undefined) return this.options.handlers;
    const config = this.options.config === undefined ? {} : { config: this.options.config };
    // The stack is read at load time: a preset builds its stages only when asked.
    const native = (stages: () => readonly Stage[]): Handler =>
      nativeHandler({
        // Read on every load, so the attribute applies without a new chain.
        prefer: (source, env) =>
          this.getAttribute(NATIVE_HLS) !== 'off' && preferNativeHls(source, env),
        drm: () => this.drm(stages),
      });
    if (this.options.stages !== undefined) {
      return [
        matteboxHandler({ stages: this.options.stages, ...config }),
        native(() => this.options.stages ?? []),
      ];
    }
    const name = this.getAttribute('preset') ?? DEFAULT_PRESET;
    const preset = await resolvePreset(name);
    if (preset === null) {
      this.report({
        category: 'config',
        code: 'CONFIG_INVALID',
        fatal: true,
        recoverable: false,
        handler: null,
        context: { preset: name },
      });
      return [nativeHandler()];
    }
    return [matteboxHandler({ preset, ...config, ...drmGuard() }), native(() => preset.stages())];
  }

  /**
   * The DRM a native session attaches: the page's `drm` option, the
   * key-system stages of the engine's stack, and the `license-url`
   * attribute. None on a browser without EME, as for the engine.
   */
  private drm(stages: () => readonly Stage[]): AttachEmeOptions | undefined {
    if (drmGuard().without !== undefined) return undefined;
    const keySystems = stages().filter((stage) => KEY_SYSTEMS.includes(stage.name));
    const license = this.getAttribute(LICENSE_URL);
    const certificate = this.getAttribute(CERTIFICATE_URL);
    const page = this.options.drm;
    if (keySystems.length === 0 && license === null && page === undefined) return undefined;
    return {
      keySystems,
      ...page,
      ...(license === null ? {} : { licenseUrl: license }),
      ...(certificate === null ? {} : { certificateUrl: certificate }),
    };
  }

  /** What the attributes ask of the session's namespaces, once there is one. */
  private configure(session: Session): void {
    const engine = session.engine;
    if (engine === null) return;

    const optional = namespaces(engine);

    // The attributes are the default. A source's own URL is already on the
    // engine: the handler set it from `source.drm` before the load.
    const own = session.source.drm;
    const license = this.getAttribute(LICENSE_URL);
    // After the session exists, not before: passing a license URL up front
    // means constructing eme-core, and importing a stage to configure it
    // would bundle it.
    if (license !== null && own?.licenseUrl === undefined) optional.drm?.setLicenseUrl(license);
    const certificate = this.getAttribute(CERTIFICATE_URL);
    if (certificate !== null && own?.certificateUrl === undefined) {
      optional.drm?.setCertificateUrl(certificate);
    }

    const track = this.getAttribute('thumbnails');
    if (track !== null && optional.thumbnails !== undefined) {
      // Loaded here; drawn by the seek bar's preview under `controls="custom"`.
      // Native controls expose no scrub position to anchor a preview to, so
      // under `native` the track only answers `engine.thumbnails.at(time)` for
      // the app. See docs/guide/03-the-element.md.
      void optional.thumbnails.load(track).catch(() => undefined);
    }
  }

  private unmount(): void {
    this.current = null;
  }

  private async teardown(): Promise<void> {
    this.unmount();
    if (this.core !== null) await this.core.unload();
  }

  /** Drops the player itself, so the next run builds a chain from the new preset. */
  private async discard(): Promise<void> {
    await this.teardown();
    for (const off of this.offs) off();
    this.offs = [];
    this.core = null;
  }
}
