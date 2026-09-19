/**
 * Chromecast from the page, over Google's Cast sender framework. The SDK is
 * a script the page loads, never a dependency (rule 2): the helper puts it
 * on the page the first time a cast button connects, unless it is already
 * there or the button says `sdk="none"`. Its context is one per page by
 * Google's design, so the receiver id the first button gives is the one
 * the page keeps.
 *
 * One `Cast` per player. It owns the handoff and nothing on the video is
 * wrapped (rule 3): on start it pauses the video, freezes the engine, and
 * sends the session's source to the receiver at the video's time; on end
 * it thaws the engine, seeks the video to the receiver's last time, and
 * plays if the receiver was playing. The cast screen drives the receiver
 * through the SDK's remote player meanwhile.
 *
 * The receiver plays the URL by itself, so DRM and signed URLs are the
 * page's to arrange: the button dispatches `castload` with the request
 * before it goes out, and the page sets `customData` or cancels.
 */
import type { PlayerHost } from './host.js';

/** Whether the session is live: the engine's `live` namespace, once it has an edge. */
function live(engine: PlayerHost['engine']): boolean {
  const api = (engine as { live?: { edge: number | null } } | null)?.live;
  return api !== undefined && api.edge !== null;
}

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
}

interface SdkSession {
  getCastDevice(): SdkDevice;
  getMediaSession(): SdkMediaSession | null;
  loadMedia(request: LoadRequest): Promise<unknown>;
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
}

interface SdkRemoteController {
  addEventListener(type: string, fn: () => void): void;
  playOrPause(): void;
  seek(): void;
  stop(): void;
}

/** What the receiver plays. The page sees it as `castload`'s `detail`. */
export interface MediaInfo {
  contentId: string;
  contentType: string;
  streamType: string;
  tracks: Track[] | null;
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
  currentTime: number;
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

export type CastState = 'unavailable' | 'idle' | 'connecting' | 'casting';

/** What the cast screen shows of the receiver. */
export interface Remote {
  readonly loaded: boolean;
  readonly paused: boolean;
  readonly time: number;
  /** Infinity for a live stream, the way the video reports it. */
  readonly duration: number;
}

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
  /** The receiver's name while casting, or null. */
  device(): string | null;
  remote(): Remote;
  /** Opens the device picker. `castload` goes out on `target` once a session starts. */
  start(target: HTMLElement): void;
  /** Ends the session and stops the receiver. */
  stop(): void;
  playPause(): void;
  seek(time: number): void;
  /** Runs `fn` on every change: devices, session, and the receiver's playback. Returns the unsubscribe. */
  watch(fn: () => void): () => void;
}

/** What the video is doing at the start of a cast, to give back at the end. */
interface Handoff {
  readonly live: boolean;
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
/** The receiver's last known playback, read while it reports and kept once it stops. */
const NOTHING: Remote = { loaded: false, paused: true, time: 0, duration: Number.NaN };
let last: Remote = NOTHING;

function globals(): Globals {
  return globalThis as Globals;
}

function notify(): void {
  for (const fn of [...watchers]) fn();
}

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
    remotePlayer = new fw.RemotePlayer();
    remoteController = new fw.RemotePlayerController(remotePlayer);
    remoteController.addEventListener(fw.RemotePlayerEventType.ANY_CHANGE, () => {
      const remote = remotePlayer;
      if (remote?.isConnected === true && remote.isMediaLoaded) {
        last = {
          loaded: true,
          paused: remote.isPaused,
          time: remote.currentTime,
          duration: remote.duration > 0 ? remote.duration : Number.POSITIVE_INFINITY,
        };
      }
      notify();
    });
  } else if (receiver !== null && receiver !== configured) {
    console.error(`mattebox-player: the Cast context already uses receiver ${configured}`);
  }
  return ctx;
}

function onSession(fw: Framework, ctx: SdkContext, state: string): void {
  const states = fw.SessionState;
  if (state === states.SESSION_STARTED && owner !== null && owner.pending) {
    // A new session has loaded nothing yet, whatever the last one played.
    last = NOTHING;
    owner.begin(ctx);
  } else if (state === states.SESSION_RESUMED) {
    // Chrome rejoins a session of this origin on load. It is this player's
    // when the receiver plays what the player has.
    const playing = ctx.getCurrentSession()?.getMediaSession()?.media?.contentId;
    const found = [...connected].find((cast) => cast.plays(playing));
    if (found !== undefined && owner === null) {
      owner = found;
      found.adopt();
    }
  } else if (state === states.SESSION_ENDED || state === states.SESSION_START_FAILED) {
    const ended = owner;
    owner = null;
    ended?.end(state === states.SESSION_ENDED);
  }
  notify();
}

/** One per player, found again by its button and its screen. Weak, so a player that leaves is not held. */
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
  declare private casting: boolean;
  declare private handoff: Handoff | null;

  constructor(player: PlayerHost) {
    this.player = player;
    this.target = null;
    this.ctx = null;
    this.fw = null;
    this.pending = false;
    this.casting = false;
    this.handoff = null;
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
    if (this.casting) return 'casting';
    const cast = ctx.getCastState();
    if (cast === fw.CastState.NO_DEVICES_AVAILABLE) return 'unavailable';
    if (cast === fw.CastState.CONNECTING || this.pending) return 'connecting';
    return 'idle';
  }

  device(): string | null {
    if (!this.casting) return null;
    return this.ctx?.getCurrentSession()?.getCastDevice().friendlyName ?? null;
  }

  remote(): Remote {
    return last;
  }

  start(target: HTMLElement): void {
    const ctx = this.ctx;
    if (ctx === null || this.casting) return;
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
    if (this.casting) this.ctx?.endCurrentSession(true);
  }

  playPause(): void {
    if (this.casting) remoteController?.playOrPause();
  }

  seek(time: number): void {
    if (!this.casting || remotePlayer === null) return;
    remotePlayer.currentTime = time;
    remoteController?.seek();
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

  /** A session started for this player: freeze the picture and send the source. */
  begin(ctx: SdkContext): void {
    this.pending = false;
    const session = this.player.player?.session ?? null;
    const video = this.player.video;
    const time = video.currentTime;
    const autoplay = !video.paused;
    this.freeze();
    if (session === null) return;
    const request = this.request(session.source, time, autoplay);
    if (request === null) return;
    const event = new CustomEvent<LoadRequest>('castload', {
      detail: request,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    if (this.target?.dispatchEvent(event) === false) return;
    void ctx
      .getCurrentSession()
      ?.loadMedia(request)
      .catch(() => {
        // The receiver refused the media. The session stays, so the viewer
        // can stop it; the screen shows no time.
      });
  }

  /** A session Chrome rejoined, already playing this player's source. */
  adopt(): void {
    this.freeze();
  }

  private freeze(): void {
    const engine = this.player.engine;
    this.handoff = { live: live(engine) };
    this.player.video.pause();
    // The engine keeps its buffers and makes no request while the receiver
    // plays (engine guide 01, suspend and resume).
    engine?.suspend();
    this.casting = true;
    this.player.toggleAttribute('casting', true);
    notify();
  }

  /** The session ended: give the video back where the receiver left it. */
  end(cleanly: boolean): void {
    this.pending = false;
    if (!this.casting) return;
    this.casting = false;
    const handoff = this.handoff;
    this.handoff = null;
    const video = this.player.video;
    const engine = this.player.engine;
    engine?.resume();
    this.player.removeAttribute('casting');
    if (!cleanly || !last.loaded) return;
    // Live rejoins at the edge on its own; the receiver's time is on the
    // receiver's own timeline and means nothing here.
    if (handoff?.live !== true && Number.isFinite(last.time)) video.currentTime = last.time;
    if (!last.paused) video.play().catch(() => undefined);
  }

  /** The load request: the source, the time, the stream type, and the video's own text tracks. */
  private request(
    source: { readonly url: string; readonly type?: string },
    time: number,
    autoplay: boolean,
  ): LoadRequest | null {
    const media = globals().chrome?.cast?.media;
    if (media === undefined) return null;
    const engine = this.player.engine;
    const type = source.type ?? '';
    const info = new media.MediaInfo(source.url, type);
    info.streamType = live(engine) ? media.StreamType.LIVE : media.StreamType.BUFFERED;
    if (/mpegurl/i.test(type)) {
      // The receiver assumes MPEG-TS segments for HLS unless told. The
      // engine's presentation says which the stream has; a native session
      // has none, and CMAF is the assumption there.
      const ts = tsSegments(engine);
      info.hlsSegmentFormat = ts ? 'ts' : 'fmp4';
      info.hlsVideoSegmentFormat = ts ? 'mpeg2_ts' : 'fmp4';
    }
    const tracks: Track[] = [];
    for (const node of this.player.video.querySelectorAll('track[src]')) {
      const track = node as HTMLTrackElement;
      if (track.kind !== 'subtitles' && track.kind !== 'captions') continue;
      const out = new media.Track(tracks.length + 1, media.TrackType.TEXT);
      out.trackContentId = track.src;
      out.trackContentType = 'text/vtt';
      out.subtype =
        track.kind === 'captions' ? media.TextTrackType.CAPTIONS : media.TextTrackType.SUBTITLES;
      out.name = track.label;
      out.language = track.srclang;
      tracks.push(out);
    }
    info.tracks = tracks.length > 0 ? tracks : null;
    const request = new media.LoadRequest(info);
    request.currentTime = time;
    request.autoplay = autoplay;
    return request;
  }
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

/** The player's Cast, one per player, shared by its cast button and cast screen. */
export function cast(player: PlayerHost): Cast {
  let held = players.get(player);
  if (held === undefined) {
    held = new CastOf(player);
    players.set(player, held);
  }
  return held;
}
