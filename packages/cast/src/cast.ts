/**
 * The Cast sender for one player, over Google's Cast Web Sender SDK. The
 * helper loads the SDK from Google's CDN unless the page already has it,
 * holds the one session the SDK allows, and hands the player a remote
 * while it runs: the player then reads the device through `player.media`,
 * keeps its video paused, and sends every load here.
 *
 * Module state and not a controller on the player: the SDK is a singleton
 * with one session per page, so the helper is one too. The cast button
 * finds the same helper through its player.
 *
 * Chromium only. Safari and Firefox never load the SDK, and the button
 * hides there; AirPlay is the player's own AirPlay button.
 *
 * The request carries the programme with the source. Cast's own fields
 * take what Cast has a field for: the URL, the type, the title and the
 * subtitle files. `customData.mattebox` takes the rest, the convention
 * `@mattebox/cast-receiver` reads: the DRM servers, the connector's type
 * and id, the metadata with the chapters and the markers, and what each
 * add-on sends. The helper dispatches `castload` with the request before
 * it goes out, so the page adds license headers there, or cancels. A
 * receiver that gets a 401 or 403 from the license server asks the sender
 * for a new token on the `urn:x-cast:ch.mattebox.license` namespace; the
 * player dispatches `castunauthorized`, and the page replies.
 */
import type { Remote, RemoteLoad, RemoteMedia } from '@mattebox/player';
import type {
  ConnectorSource,
  ProgrammeMetadata,
  Source,
  SourceVideoTrack,
} from '@mattebox/player-core';
import type { PlayerHost } from './host.js';

// The slice of the sender SDK the helper reads. No `@types/chromecast`:
// the SDK is not a dependency, and these names are what the page's script
// puts on `window.cast.framework` and `window.chrome.cast`.

interface SdkEvent {
  readonly castState?: string;
  readonly sessionState?: string;
}

interface SdkDevice {
  readonly friendlyName: string;
}

interface SdkMediaSession {
  readonly media?: { readonly contentId?: string } | null;
  readonly idleReason?: string | null;
}

interface SdkSession {
  getCastDevice(): SdkDevice;
  getMediaSession(): SdkMediaSession | null;
  loadMedia(request: LoadRequest): Promise<unknown>;
  addMessageListener(namespace: string, fn: (namespace: string, message: string) => void): void;
  removeMessageListener(namespace: string, fn: (namespace: string, message: string) => void): void;
  sendMessage(namespace: string, message: unknown): Promise<unknown>;
}

/** The custom namespace a receiver asks the sender for a new license token on. */
export const LICENSE_NAMESPACE = 'urn:x-cast:ch.mattebox.license';

/** What the page replies to `castunauthorized`: new license headers or servers for the receiver. */
export interface LicenseReply {
  readonly licenseHeaders?: Readonly<Record<string, string>>;
  readonly licenseUrl?: string;
  readonly licenseUrls?: Readonly<Record<string, string>>;
}

/** `castunauthorized`'s `detail`: the receiver's license server answered 401 or 403. */
export interface UnauthorizedDetail {
  readonly keySystem: string;
  readonly status: number;
  /** Sends the new token to the receiver. Call it once, with the reply or a promise of it. */
  reply(reply: LicenseReply | Promise<LicenseReply>): void;
}

/**
 * `customData.mattebox`, as `@mattebox/cast-receiver` reads it. Every
 * member is optional, and a receiver ignores the ones it does not know.
 */
export interface MatteboxCustomData {
  licenseUrl?: string;
  licenseUrls?: Readonly<Record<string, string>>;
  certificateUrl?: string;
  /** Headers for the license requests. The player has none of its own; a `castload` listener adds them. */
  licenseHeaders?: Record<string, string>;
  /** The URL of the thumbnail track. */
  thumbnails?: string;
  /** The connector the programme came from: its type, with its id or its data. */
  programme?: ConnectorSource;
  /** The title, the subtitle, the description, the image, the poster, the chapters and the markers. */
  metadata?: ProgrammeMetadata;
  /** The URL of a chapters file. */
  chapters?: string;
  /** The other versions of the picture, such as sign language. */
  videoTracks?: readonly SourceVideoTrack[];
  /** The clock time a live viewer watches, in epoch seconds. Absent at the live edge. */
  date?: number;
  /** What each add-on of the page sends, under its name. */
  addons?: { readonly [name: string]: unknown };
}

interface SdkContext {
  setOptions(options: { receiverApplicationId: string; autoJoinPolicy: string }): void;
  addEventListener(type: string, fn: (event: SdkEvent) => void): void;
  getCastState(): string;
  getCurrentSession(): SdkSession | null;
  requestSession(): Promise<unknown>;
  endCurrentSession(stopCasting: boolean): void;
}

interface SdkRemotePlayer {
  isConnected: boolean;
  isMediaLoaded: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  playerState: string | null;
  volumeLevel?: number;
  isMuted?: boolean;
  liveSeekableRange?: { readonly start?: number; readonly end?: number } | null;
}

interface SdkRemoteController {
  addEventListener(type: string, fn: () => void): void;
  playOrPause(): void;
  seek(): void;
  stop(): void;
  setVolumeLevel?(): void;
  muteOrUnmute?(): void;
}

/** The title, the subtitle and the image, where Google's own screens read them. */
export interface CastMetadata {
  metadataType: number;
  title?: string;
  subtitle?: string;
  images?: { url: string }[];
}

/** What the receiver plays. The page sees it as `castload`'s `detail`. */
export interface MediaInfo {
  contentId: string;
  contentType: string;
  streamType: string;
  tracks: Track[] | null;
  metadata?: CastMetadata | null;
  hlsSegmentFormat?: string;
  hlsVideoSegmentFormat?: string;
}

export interface Track {
  trackContentId: string;
  trackContentType: string;
  subtype: string;
  name: string;
  language: string;
}

export interface LoadRequest {
  media: MediaInfo;
  currentTime?: number;
  autoplay: boolean;
  customData: unknown;
}

interface Framework {
  CastContext: { getInstance(): SdkContext };
  RemotePlayer: new () => SdkRemotePlayer;
  RemotePlayerController: new (player: SdkRemotePlayer) => SdkRemoteController;
  CastContextEventType: { CAST_STATE_CHANGED: string; SESSION_STATE_CHANGED: string };
  CastState: { NO_DEVICES_AVAILABLE: string; CONNECTING: string; CONNECTED: string };
  SessionState: {
    SESSION_STARTED: string;
    SESSION_RESUMED: string;
    SESSION_ENDED: string;
    SESSION_START_FAILED: string;
  };
  RemotePlayerEventType: { ANY_CHANGE: string };
}

interface ChromeCast {
  AutoJoinPolicy: { ORIGIN_SCOPED: string };
  media: {
    MediaInfo: new (contentId: string, contentType: string) => MediaInfo;
    LoadRequest: new (media: MediaInfo) => LoadRequest;
    Track: new (trackId: number, type: string) => Track;
    TrackType: { TEXT: string };
    TextTrackType: { SUBTITLES: string; CAPTIONS: string };
    StreamType: { BUFFERED: string; LIVE: string };
  };
}

interface Globals {
  cast?: { framework?: Framework };
  chrome?: { cast?: ChromeCast };
  __onGCastApiAvailable?: (available: boolean) => void;
}

/** The Default Media Receiver: Google's player, which plays HLS and DASH by itself. */
const DEFAULT_RECEIVER = 'CC1AD845';
const SDK_URL = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';

/**
 * A Cast transport message holds 64 kB (Cast media messages, "Message
 * size"). The request's JSON stays under this, which leaves room for the
 * envelope around it.
 */
const MAX_REQUEST = 60000;

/** The kind the player carries in `casting` while this package's device plays. */
const KIND = 'chromecast';

export type CastState = 'unavailable' | 'idle' | 'connecting' | 'casting';

export interface Cast {
  /**
   * Puts the SDK on the page unless `sdk` is `none` or it is already there,
   * and sets the context up with `receiver`, or the default receiver. The
   * first call on the page decides both; a later different receiver is an
   * error on the console, not a second context.
   */
  connect(receiver: string | null, sdk: string | null): void;
  /** The button left the player: a rejoined session no longer looks here. */
  disconnect(): void;
  state(): CastState;
  /** Opens the device picker. `castload` goes out on `target` with each load of the session. */
  start(target: HTMLElement): void;
  /** Ends the session and stops the receiver. */
  stop(): void;
  /** Runs `fn` on every change: devices and session. Returns the unsubscribe. */
  watch(fn: () => void): () => void;
}

// The page-wide part: one SDK, one context, one remote player. Held in the
// module because the SDK holds them in the window.

let framework: Promise<Framework | null> | null = null;
let configured: string | null = null;
let remotePlayer: SdkRemotePlayer | null = null;
let remoteController: SdkRemoteController | null = null;
const watchers = new Set<() => void>();
/** The player whose session this is, so two players on a page do not both take a session. */
let owner: CastOf | null = null;

function globals(): Globals {
  return globalThis as Globals;
}

function notify(): void {
  for (const fn of [...watchers]) fn();
}

/** What the device last reported, kept once it stops reporting. */
interface Seen {
  loaded: boolean;
  paused: boolean;
  time: number;
  duration: number;
  volume: number;
  muted: boolean;
  state: string | null;
  start: number;
  end: number;
}

/**
 * The device's playback, as the player's `media` reads it: the SDK's
 * remote player behind the members of a video, and its reports as the
 * video's events. The values are the last the device reported, so the end
 * of the session still says where it stopped.
 */
class DeviceMedia extends EventTarget implements RemoteMedia {
  declare private seen: Seen;
  /** The media ran to its end on the device. */
  declare private finished: boolean;
  /** A seek went out, and the device has not answered it. */
  declare private seeking: boolean;
  /** Loads the last request again from its start, for a play after the end. */
  declare replay: (() => void) | null;

  constructor() {
    super();
    this.seen = {
      loaded: false,
      paused: true,
      time: 0,
      duration: Number.NaN,
      volume: 1,
      muted: false,
      state: null,
      start: 0,
      end: 0,
    };
    this.finished = false;
    this.seeking = false;
    this.replay = null;
  }

  /** A new load: what the last one reported is no longer true. */
  reset(time: number, playing: boolean): void {
    this.seen.loaded = false;
    this.seen.time = time;
    this.seen.paused = !playing;
    this.finished = false;
    this.seeking = false;
    this.say('timeupdate');
  }

  /** Reads the SDK's remote player after one of its changes, and says what changed. */
  report(remote: SdkRemotePlayer, session: SdkSession | null): void {
    if (!remote.isConnected) return;
    const was = this.seen;
    if (!remote.isMediaLoaded) {
      if (!was.loaded) return;
      // The media left the device: it ended, or a sender stopped it.
      const ended =
        session?.getMediaSession()?.idleReason === 'FINISHED' ||
        (Number.isFinite(was.duration) && was.duration - was.time < 1);
      this.seen = { ...was, loaded: false, paused: true, state: null };
      if (ended) {
        this.finished = true;
        this.seen.time = Number.isFinite(was.duration) ? was.duration : was.time;
        this.say('timeupdate');
      }
      if (!was.paused) this.say('pause');
      if (ended) this.say('ended');
      return;
    }
    const range = remote.liveSeekableRange ?? null;
    const duration = remote.duration > 0 ? remote.duration : Number.POSITIVE_INFINITY;
    const next: Seen = {
      loaded: true,
      paused: remote.isPaused,
      time: remote.currentTime,
      duration,
      volume: remote.volumeLevel ?? was.volume,
      muted: remote.isMuted ?? was.muted,
      state: remote.playerState,
      start: range?.start ?? 0,
      end: range?.end ?? (Number.isFinite(duration) ? duration : 0),
    };
    this.seen = next;
    this.finished = false;
    if (
      next.duration !== was.duration &&
      !(Number.isNaN(next.duration) && Number.isNaN(was.duration))
    ) {
      this.say('durationchange');
    }
    if (next.time !== was.time) {
      this.say('timeupdate');
      if (this.seeking) {
        this.seeking = false;
        this.say('seeked');
      }
    }
    if (next.paused !== was.paused || !was.loaded) this.say(next.paused ? 'pause' : 'play');
    if (next.state !== was.state) {
      if (next.state === 'BUFFERING') this.say('waiting');
      else if (next.state === 'PLAYING') this.say('playing');
    }
    if (next.volume !== was.volume || next.muted !== was.muted) this.say('volumechange');
  }

  private say(name: string): void {
    this.dispatchEvent(new Event(name));
  }

  get currentTime(): number {
    return this.seen.time;
  }

  set currentTime(value: number) {
    const remote = remotePlayer;
    if (remote === null || !this.seen.loaded) return;
    this.seen.time = value;
    this.seeking = true;
    remote.currentTime = value;
    remoteController?.seek();
    this.say('seeking');
    this.say('timeupdate');
  }

  get duration(): number {
    return this.seen.duration;
  }

  get paused(): boolean {
    return this.seen.paused;
  }

  get ended(): boolean {
    return this.finished;
  }

  get seekable(): RemoteMedia['seekable'] {
    const { start, end } = this.seen;
    return {
      length: end > start ? 1 : 0,
      start: () => start,
      end: () => end,
    };
  }

  get volume(): number {
    return this.seen.volume;
  }

  set volume(value: number) {
    const remote = remotePlayer;
    if (remote === null) return;
    remote.volumeLevel = value;
    remoteController?.setVolumeLevel?.();
  }

  get muted(): boolean {
    return this.seen.muted;
  }

  set muted(value: boolean) {
    if (remotePlayer !== null && this.seen.muted !== value) remoteController?.muteOrUnmute?.();
  }

  play(): Promise<void> {
    if (!this.seen.loaded) this.replay?.();
    else if (this.seen.paused) remoteController?.playOrPause();
    return Promise.resolve();
  }

  pause(): void {
    if (this.seen.loaded && !this.seen.paused) remoteController?.playOrPause();
  }
}

/** The device's playback for the session that runs. One per session: a new session reports from nothing. */
let device: DeviceMedia | null = null;

/**
 * The framework, once the page has it. Resolves null where the SDK never
 * arrives: a browser without Cast, a page whose CSP refused the script, or
 * `sdk="none"` with no script of the page's own.
 */
function load(sdk: string | null): Promise<Framework | null> {
  if (framework !== null) return framework;
  const held = globals();
  if (held.cast?.framework !== undefined) {
    framework = Promise.resolve(held.cast.framework);
    return framework;
  }
  // The SDK is Chromium's. Elsewhere the script only reports that it is
  // unavailable, so it is not fetched.
  if (!('chrome' in held)) {
    framework = Promise.resolve(null);
    return framework;
  }
  framework = new Promise((resolve) => {
    const previous = held.__onGCastApiAvailable;
    // The SDK calls this once it is in, on its own script or the page's.
    held.__onGCastApiAvailable = (available: boolean): void => {
      previous?.(available);
      resolve(available ? (globals().cast?.framework ?? null) : null);
    };
    if (sdk === 'none') return;
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.addEventListener('error', () => resolve(null));
    document.head.append(script);
  });
  return framework;
}

/** The context, set up once per page. */
function context(fw: Framework, receiver: string | null): SdkContext {
  const ctx = fw.CastContext.getInstance();
  const wanted = receiver ?? DEFAULT_RECEIVER;
  if (configured === null) {
    const policy = globals().chrome?.cast?.AutoJoinPolicy.ORIGIN_SCOPED ?? 'origin_scoped';
    ctx.setOptions({ receiverApplicationId: wanted, autoJoinPolicy: policy });
    configured = wanted;
    ctx.addEventListener(fw.CastContextEventType.CAST_STATE_CHANGED, notify);
    ctx.addEventListener(fw.CastContextEventType.SESSION_STATE_CHANGED, (event) => {
      onSession(fw, ctx, event.sessionState ?? '');
    });
    const remote = new fw.RemotePlayer();
    remotePlayer = remote;
    remoteController = new fw.RemotePlayerController(remote);
    remoteController.addEventListener(fw.RemotePlayerEventType.ANY_CHANGE, () => {
      device?.report(remote, ctx.getCurrentSession());
    });
  } else if (receiver !== null && receiver !== configured) {
    console.error(`mattebox-player: the Cast context already uses receiver ${configured}`);
  }
  return ctx;
}

function onSession(fw: Framework, ctx: SdkContext, state: string): void {
  const states = fw.SessionState;
  if (state === states.SESSION_STARTED && owner !== null && owner.pending) {
    owner.begin(ctx, false);
  } else if (state === states.SESSION_RESUMED) {
    // Chrome rejoins a session of this origin on load. It is this player's
    // when the receiver plays what the player has.
    const playing = ctx.getCurrentSession()?.getMediaSession()?.media?.contentId;
    const found = [...connected].find((cast) => cast.plays(playing));
    if (found !== undefined && owner === null) {
      owner = found;
      found.begin(ctx, true);
    }
  } else if (state === states.SESSION_ENDED || state === states.SESSION_START_FAILED) {
    const ended = owner;
    owner = null;
    ended?.end();
  }
  notify();
}

/** One per player, found again by its button. Weak, so a player that leaves is not held. */
const players = new WeakMap<PlayerHost, CastOf>();
/** The players with a cast button attached, for a session Chrome rejoins on load. */
const connected = new Set<CastOf>();

class CastOf implements Cast {
  declare private readonly player: PlayerHost;
  declare private target: HTMLElement | null;
  declare private ctx: SdkContext | null;
  declare private fw: Framework | null;
  /** This player asked for a session and waits for it to start. */
  declare pending: boolean;
  /** Ends the cast on the player, while a session of this player runs. */
  declare private uncast: (() => void) | null;
  /** The session this player listens on for license token requests, and its listener. */
  declare private listening: {
    readonly session: SdkSession;
    readonly fn: (namespace: string, message: string) => void;
  } | null;

  constructor(player: PlayerHost) {
    this.player = player;
    this.target = null;
    this.ctx = null;
    this.fw = null;
    this.pending = false;
    this.uncast = null;
    this.listening = null;
  }

  connect(receiver: string | null, sdk: string | null): void {
    connected.add(this);
    void load(sdk).then((fw) => {
      if (fw === null) return;
      this.fw = fw;
      this.ctx = context(fw, receiver);
      notify();
    });
  }

  disconnect(): void {
    connected.delete(this);
  }

  state(): CastState {
    const ctx = this.ctx;
    const fw = this.fw;
    if (ctx === null || fw === null) return 'unavailable';
    if (this.uncast !== null) return 'casting';
    const cast = ctx.getCastState();
    if (cast === fw.CastState.NO_DEVICES_AVAILABLE) return 'unavailable';
    if (cast === fw.CastState.CONNECTING || this.pending) return 'connecting';
    return 'idle';
  }

  start(target: HTMLElement): void {
    const ctx = this.ctx;
    if (ctx === null || this.uncast !== null) return;
    // Another player on the page holds the session. The SDK has one, so
    // this click ends it, the way Chrome's own dialog offers to.
    if (owner !== null && owner !== this) {
      ctx.endCurrentSession(true);
      return;
    }
    this.target = target;
    this.pending = true;
    owner = this;
    notify();
    // Rejected when the viewer closes the picker; SESSION_START_FAILED
    // does not fire for that, so the wait ends here.
    ctx.requestSession().catch(() => {
      if (owner === this) owner = null;
      this.pending = false;
      notify();
    });
  }

  stop(): void {
    if (this.uncast !== null) this.ctx?.endCurrentSession(true);
  }

  watch(fn: () => void): () => void {
    watchers.add(fn);
    return () => {
      watchers.delete(fn);
    };
  }

  /** Whether this player's session plays `url`. */
  plays(url: string | undefined): boolean {
    return url !== undefined && this.player.player?.session?.source.url === url;
  }

  /**
   * A session started for this player, or Chrome rejoined one that already
   * plays its source: the device plays in the video's place from here.
   */
  begin(ctx: SdkContext, adopted: boolean): void {
    this.pending = false;
    const session = ctx.getCurrentSession();
    if (session === null) return;
    this.listen(session);
    const media = new DeviceMedia();
    device = media;
    const remote: Remote = {
      target: { kind: KIND, name: session.getCastDevice().friendlyName },
      media,
      load: (source, load) => this.send(session, media, source, load),
      stop: () => remoteController?.stop(),
    };
    // A session that already plays reports its state at once.
    if (adopted && remotePlayer !== null) media.report(remotePlayer, session);
    this.uncast = this.player.cast(remote, { adopted });
  }

  /** The session ended: the video takes the device's position back. */
  end(): void {
    this.pending = false;
    this.unlisten();
    const uncast = this.uncast;
    this.uncast = null;
    uncast?.();
    device = null;
  }

  /** Sends one load of the player to the receiver. Rejects when the receiver refuses it. */
  private send(
    session: SdkSession,
    media: DeviceMedia,
    source: Source,
    load: RemoteLoad,
  ): Promise<void> {
    const request = this.request(source, load);
    if (request === null) return Promise.reject(new Error('the Cast SDK is gone'));
    if (JSON.stringify(request).length > MAX_REQUEST) {
      return Promise.reject(new Error('the load is larger than a Cast message'));
    }
    const event = new CustomEvent<LoadRequest>('castload', {
      detail: request,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    // The page said no: nothing goes out, and that is no failure.
    if (!(this.target ?? this.player).dispatchEvent(event)) return Promise.resolve();
    media.reset(request.currentTime ?? 0, request.autoplay);
    media.replay = (): void => {
      const again: LoadRequest = { ...request, autoplay: true };
      delete again.currentTime;
      media.reset(0, true);
      void session.loadMedia(again).catch(() => undefined);
    };
    return session.loadMedia(request).then(() => undefined);
  }

  /**
   * Answers the receiver's token requests for this session: a
   * `castunauthorized` event on the player, and the page's reply sent back.
   */
  private listen(session: SdkSession): void {
    this.unlisten();
    const fn = (_namespace: string, message: string): void => {
      let data: { type?: unknown; id?: unknown; keySystem?: unknown; status?: unknown };
      try {
        data = JSON.parse(message) as typeof data;
      } catch {
        return;
      }
      if (data.type !== 'unauthorized') return;
      const id = data.id;
      let replied = false;
      const detail: UnauthorizedDetail = {
        keySystem: typeof data.keySystem === 'string' ? data.keySystem : '',
        status: typeof data.status === 'number' ? data.status : 0,
        reply(reply) {
          if (replied) return;
          replied = true;
          void Promise.resolve(reply)
            .then((answer) =>
              session.sendMessage(LICENSE_NAMESPACE, { type: 'license', id, ...answer }),
            )
            .catch(() => {
              // No reply reaches the receiver; it gives up after its own wait.
            });
        },
      };
      this.player.dispatchEvent(
        new CustomEvent<UnauthorizedDetail>('castunauthorized', { detail, bubbles: true }),
      );
    };
    session.addMessageListener(LICENSE_NAMESPACE, fn);
    this.listening = { session, fn };
  }

  private unlisten(): void {
    const held = this.listening;
    this.listening = null;
    held?.session.removeMessageListener(LICENSE_NAMESPACE, held.fn);
  }

  /** The load request: Cast's own fields, and `customData.mattebox` for what Cast has no field for. */
  private request(source: Source, load: RemoteLoad): LoadRequest | null {
    const media = globals().chrome?.cast?.media;
    if (media === undefined) return null;
    const engine = this.player.engine;
    const type = source.type ?? '';
    const info = new media.MediaInfo(source.url, type);
    info.streamType = load.live ? media.StreamType.LIVE : media.StreamType.BUFFERED;
    if (/mpegurl/i.test(type)) {
      // The receiver assumes MPEG-TS segments for HLS unless told. The
      // engine's presentation says which the stream has; a native session
      // has none, and CMAF is the assumption there.
      const ts = tsSegments(engine);
      info.hlsSegmentFormat = ts ? 'ts' : 'fmp4';
      info.hlsVideoSegmentFormat = ts ? 'mpeg2_ts' : 'fmp4';
    }
    const tracks: Track[] = [];
    for (const file of load.textTracks) {
      const out = new media.Track(tracks.length + 1, media.TrackType.TEXT);
      out.trackContentId = file.url;
      out.trackContentType = 'text/vtt';
      out.subtype =
        file.kind === 'captions' ? media.TextTrackType.CAPTIONS : media.TextTrackType.SUBTITLES;
      out.name = file.label;
      out.language = file.language;
      tracks.push(out);
    }
    info.tracks = tracks.length > 0 ? tracks : null;
    const programme = load.programme;
    const known = programme?.metadata;
    // Google's own screens show these: the Home app, and the other senders of the session.
    if (known?.title !== undefined || known?.subtitle !== undefined || known?.image !== undefined) {
      info.metadata = {
        metadataType: 0,
        ...(known.title === undefined ? {} : { title: known.title }),
        ...(known.subtitle === undefined ? {} : { subtitle: known.subtitle }),
        ...(known.image === undefined ? {} : { images: [{ url: known.image }] }),
      };
    }
    const request = new media.LoadRequest(info);
    if (typeof load.at === 'number') request.currentTime = load.at;
    request.autoplay = load.playing;
    const mattebox = customData(source, load);
    if (Object.keys(mattebox).length > 0) request.customData = { mattebox };
    // The connector's data goes first when the request is too large: with
    // its id, the receiver's connector fetches it again.
    if (JSON.stringify(request).length > MAX_REQUEST && mattebox.programme?.data !== undefined) {
      const { type: connector, id } = mattebox.programme;
      if (id === undefined) delete mattebox.programme;
      else mattebox.programme = { type: connector, id };
    }
    return request;
  }
}

/** `customData.mattebox` of one load: what Cast has no field for. */
function customData(source: Source, load: RemoteLoad): MatteboxCustomData {
  const out: MatteboxCustomData = {};
  const drm = source.drm;
  if (drm?.licenseUrl !== undefined) out.licenseUrl = drm.licenseUrl;
  if (drm?.licenseUrls !== undefined) out.licenseUrls = drm.licenseUrls;
  if (drm?.certificateUrl !== undefined) out.certificateUrl = drm.certificateUrl;
  if (load.thumbnails !== undefined) out.thumbnails = load.thumbnails;
  if (load.chapters !== undefined) out.chapters = load.chapters;
  if (source.videoTracks !== undefined && source.videoTracks.length > 0) {
    out.videoTracks = source.videoTracks;
  }
  if (typeof load.at === 'object' && load.at !== null) out.date = load.at.date;
  const programme = load.programme;
  if (programme?.type !== undefined) {
    // The data only for a programme the page loaded by its data alone: with
    // an id, the receiver's connector fetches its own.
    out.programme = {
      type: programme.type,
      ...(programme.id === undefined ? {} : { id: programme.id }),
      ...(programme.id !== undefined || programme.data === undefined
        ? {}
        : { data: programme.data }),
    };
  }
  // The player's markers now, over the ones the programme came with: the page may have set its own.
  const { markers: _first, ...rest } = programme?.metadata ?? {};
  const metadata: ProgrammeMetadata = {
    ...rest,
    ...(load.markers.length === 0 ? {} : { markers: load.markers }),
  };
  if (Object.keys(metadata).length > 0) out.metadata = metadata;
  if (Object.keys(load.addons).length > 0) out.addons = load.addons;
  return out;
}

/** Whether the engine's presentation carries MPEG-TS renditions. */
function tsSegments(engine: PlayerHost['engine']): boolean {
  const presentation = engine?.stats.snapshot().presentation;
  if (presentation === null || presentation === undefined) return false;
  for (const period of presentation.periods) {
    for (const track of period.tracks) {
      for (const rendition of track.renditions) {
        if (/mp2t/i.test(rendition.mimeType)) return true;
      }
    }
  }
  return false;
}

/** The player's Cast, one per player, shared by its cast button. */
export function cast(player: PlayerHost): Cast {
  let held = players.get(player);
  if (held === undefined) {
    held = new CastOf(player);
    players.set(player, held);
  }
  return held;
}
