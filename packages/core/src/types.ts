/**
 * The three concepts of the core: a source, the handlers that claim it, and
 * the session a handler returns. The player is the chain runner over them.
 */
import type { Mattebox } from 'mattebox';
import type { EmeAttachment } from 'mattebox/eme';
import type { ChapterInput } from 'mattebox/stages/chapters';

/** A URL and, when known, its MIME type. Without a type the extension decides, see `inferType`. */
export interface Source {
  readonly url: string;
  readonly type?: string;
  /** The DRM servers of this source. The handlers apply them, over their own options. */
  readonly drm?: SourceDrm;
  /**
   * Other versions of this picture at their own URLs, such as a
   * sign-language version. The player's video menu lists them with the
   * video tracks of the manifest, and plays one from the same position.
   */
  readonly videoTracks?: readonly SourceVideoTrack[];
  /** Seconds to start from. The engine fetches from there; a native video seeks there first. */
  readonly start?: number;
}

/** A version of a source's picture at its own URL. */
export interface SourceVideoTrack {
  readonly url: string;
  readonly type?: string;
  readonly drm?: SourceDrm;
  /** The version, in the names of HTML's `VideoTrack.kind`: `sign`, `captions`, `alternative`. */
  readonly kind: string;
  /** The name a menu shows. Without it, the menu names the kind. */
  readonly label?: string;
  /** The language tag, such as `sgg` for Swiss German Sign Language. */
  readonly language?: string;
}

/** Where one source gets its licenses and its FairPlay certificate. */
export interface SourceDrm {
  readonly licenseUrl?: string;
  /** One server per key system, keyed by name such as `com.widevine.alpha`. It wins over `licenseUrl`. */
  readonly licenseUrls?: Readonly<Record<string, string>>;
  readonly certificateUrl?: string;
}

/** Words in one language, or by language tag, such as `{ de: '…', fr: '…', en: '…' }`. */
export type Text = string | { readonly [language: string]: string };

/**
 * Why the programme does not play, as the page's content API says: the
 * player shows it over the picture in place of the video.
 */
export interface Block {
  /** The title. Without one, the player's own words for "Not available". */
  readonly title?: Text;
  /** What the viewer reads under the title, such as "Only available in Switzerland". */
  readonly message?: Text;
}

/** A range of the programme a content API names, in seconds. */
export interface Marker {
  readonly start: number;
  readonly end: number;
  /**
   * What the range is: `opening-credits`, `closing-credits`, `blocked`, or
   * a page's own word.
   */
  readonly kind: string;
  /**
   * Words for the range: what a skip button names for a kind it does not
   * know, and what the seek bar's preview shows over a blocked range. By
   * language tag, the player reads them in its own language.
   */
  readonly label?: Text;
}

/**
 * A programme a connector resolves: by `id`, which the connector fetches,
 * or by `data` you already have, which it resolves without a fetch. Give
 * the id with the data to name the programme to your trackers.
 */
export interface ConnectorSource {
  /** The type a connector is registered for, such as `srgssr/urn`. */
  readonly type: string;
  readonly id?: string;
  readonly data?: unknown;
}

/** What `load` takes: a URL, or a programme a connector resolves. */
export type ProgrammeSource = Source | ConnectorSource;

/**
 * Turns the id of a programme into what plays, for one source type. A
 * connector without `fetch` takes injected data only.
 */
export interface Connector<Data = unknown> {
  readonly type: string;
  /** Fetches the programme's data from your content API. */
  fetch?(id: string, signal: AbortSignal): Promise<Data>;
  /**
   * The sources, the metadata and the block of the data. It may fetch
   * what each playback needs, such as a token, but never the data itself.
   */
  resolve(data: Data, signal: AbortSignal): Resolution | Promise<Resolution>;
}

/** What a connector resolves a programme to. */
export interface Resolution {
  /** Tried in order, as a `sources` list is. */
  readonly sources: readonly Source[];
  /** Why the programme does not play. A block wins over the sources: nothing loads. */
  readonly block?: Block;
  readonly metadata?: ProgrammeMetadata;
}

/** What a content API says about a programme, which the stream does not carry. */
export interface ProgrammeMetadata {
  readonly title?: string;
  readonly subtitle?: string;
  readonly description?: string;
  /** The URL of the programme's image, for a title or a system's media controls. */
  readonly image?: string;
  /** The URL of the picture the video shows before it plays. */
  readonly poster?: string;
  readonly chapters?: readonly ChapterInput[];
  /** Credits to skip and parts that must not play. */
  readonly markers?: readonly Marker[];
}

/** One `load`: what the page gave, and what it resolved to. */
export interface Programme extends Resolution {
  /** The sources the page gave `load`, in its order. */
  readonly given: readonly ProgrammeSource[];
  /** The first connector input of `given`: its type, id and data. Absent without one. */
  readonly type?: string;
  readonly id?: string;
  readonly data?: unknown;
}

/** How much of a source to fetch ahead of its load. */
export interface PreloadOptions {
  /** Media segments per track, with the playlists and init segments they need. 0, the default, is the manifest alone. */
  readonly segments?: number;
  /** Seconds the responses are kept for the load. 30 by default. */
  readonly keepSeconds?: number;
}

/** What a handler sees when asked whether it can play a source. */
export interface HandlerEnvironment {
  readonly video: HTMLMediaElement;
  /** `MediaSource` or `ManagedMediaSource` is present. */
  readonly mse: boolean;
}

/** The three-tier answer of `HTMLMediaElement.canPlayType`. An empty string declines. */
export type CanHandle = 'probably' | 'maybe' | '';

export interface Handler {
  readonly name: string;
  canHandle(source: Source, env: HandlerEnvironment): CanHandle;
  /**
   * True asks this handler first for the source, before the handlers ahead
   * of it in the chain. Handlers that prefer a source keep their order among
   * themselves.
   */
  prefers?(source: Source, env: HandlerEnvironment): boolean;
  handle(source: Source, video: HTMLMediaElement): Promise<HandlerSession>;
  /**
   * Fetches the start of a source ahead of its load, while another source
   * plays. A handler without it preloads nothing.
   */
  preload?(source: Source, options?: PreloadOptions): Promise<void>;
}

/** What a handler returns: its claim on the element. The chain runner adds the source. */
export interface HandlerSession {
  /** The name of the handler that won. */
  readonly handler: string;
  /** The engine feeding the element, or null for native playback. The UI feature-tests its namespaces. */
  readonly engine: Mattebox | null;
  /** The engine's DRM on the element, for a native session that attached it. */
  readonly eme?: EmeAttachment;
  dispose(): Promise<void>;
}

/** What a handler holds on the element until disposed, and what it plays. */
export interface Session extends HandlerSession {
  /**
   * The source the chain resolved: the URL, and the type the page gave or
   * the extension implied. A control reads it here because the element's
   * `src` is the page's input and carries no type.
   */
  readonly source: Source;
}

/** One shape for the engine's errors and the element's `MediaError`. */
export interface PlayerError {
  readonly category: string;
  readonly code: string;
  readonly fatal: boolean;
  readonly recoverable: boolean;
  /** The handler whose session reported it, or null when no handler claimed the source. */
  readonly handler: string | null;
  readonly context?: Readonly<Record<string, unknown>>;
  /** The source that failed, on the error of a source the list had another one after. */
  readonly source?: Source;
}

export interface PlayerEvents {
  /** A load resolved its sources, before any handler runs; null at unload. */
  readonly programme: Programme | null;
  /** A session replaced another, or was unloaded (null). */
  readonly sourcechange: Session | null;
  readonly error: PlayerError;
}

export type PlayerEvent = keyof PlayerEvents;

export interface PlayerOptions {
  /** Tried in order; the first non-empty `canHandle` wins. Order is the integrator's policy. */
  readonly handlers: readonly Handler[];
  /** One per source type. A source of another type goes to the handlers as it is. */
  readonly connectors?: readonly Connector[];
}

export interface Player {
  /**
   * Disposes the current session, then runs the chain. Concurrent loads resolve in order; the last wins.
   *
   * A list is tried in its order, as the `<source>` children of a video are.
   * A source no handler takes is passed over. A source that fails with a
   * fatal error before the video's first `playing` event is replaced by
   * the next one: each reports a non-fatal `error` that carries `source`,
   * and `sourcechange` fires for the session that replaces it. The error of
   * the last source is fatal.
   *
   * A connector source resolves first, through the connector of its type,
   * and a new load aborts it. A `Source` whose type names a connector gives
   * its URL as the id. `programme` fires once the list is resolved. A
   * blocked programme loads nothing, and the promise rejects with `Blocked`.
   */
  load(source: ProgrammeSource | readonly ProgrammeSource[]): Promise<Session>;
  /**
   * Plays `source` on the video in the programme's place, such as an ad.
   * The programme stays `programme`, and neither `programme` nor
   * `sourcechange` fires. An error of the source is not reported: the page
   * that interrupted listens to the video. `resume` plays the programme
   * again.
   */
  interrupt(source: Source): Promise<Session>;
  /**
   * Loads the source the programme played before `interrupt` again, from
   * `start` seconds, and fires nothing. Null when nothing was interrupted.
   */
  resume(start?: number): Promise<Session | null>;
  /** An `interrupt` plays in the programme's place. */
  readonly interrupted: boolean;
  unload(): Promise<void>;
  /**
   * Fetches the start of a source ahead of its load. It asks the handler
   * `load` would give the source to, whatever session plays now: of a list,
   * the first source a handler takes. It resolves with nothing done when
   * that handler has no `preload`, and never rejects.
   *
   * A connector source resolves here: its connector fetches the data and
   * resolves it, and its first source preloads. The next `load` of the
   * same programme, by its type and id or by the same data, takes that
   * resolution and asks the connector nothing, within `keepSeconds`. One
   * preload is kept at a time.
   */
  preload(
    source: ProgrammeSource | readonly ProgrammeSource[],
    options?: PreloadOptions,
  ): Promise<void>;
  readonly session: Session | null;
  /** What the current load resolved to, or null before one and after `unload`. */
  readonly programme: Programme | null;
  /** What the last `preload` of a connector source resolved, such as the next title, or null. */
  readonly preloaded: Programme | null;
  on<E extends PlayerEvent>(event: E, fn: (payload: PlayerEvents[E]) => void): () => void;
}
