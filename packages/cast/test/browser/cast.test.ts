/**
 * <mbx-cast-button> and <mbx-cast-screen> from outside the player package,
 * the way a page gets them, over a faked sender SDK, so every browser runs
 * the suite and nothing reaches gstatic. The device picker is
 * Chrome's own dialog and is only testable on a device; what is asserted
 * here is presence, the handoff, the request, and the screen's controls.
 *
 * The helper keeps the SDK and its context once per page, so the fake is
 * installed once for the file and its state reset between tests.
 */
import { MatteboxPlayerElement } from '@mattebox/player';
import type { CastLoadRequest } from '@mattebox/player-cast';
import '@mattebox/player-cast';
import type { Handler, HandlerSession } from '@mattebox/player-core';
import { nativeHandler } from '@mattebox/player-core';
import type { Mattebox } from 'mattebox';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { once, silence } from './helpers.js';

type Listener = (event: { sessionState?: string; castState?: string }) => void;

interface FakeSession {
  readonly name: string;
  readonly loads: CastLoadRequest[];
  contentId: string | undefined;
  getCastDevice(): { friendlyName: string };
  getMediaSession(): { media: { contentId: string | undefined } } | null;
  loadMedia(request: CastLoadRequest): Promise<void>;
}

interface FakeRemote {
  isConnected: boolean;
  isMediaLoaded: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  playerState: string | null;
}

const listeners = new Map<string, Set<Listener>>();
const remoteListeners = new Set<() => void>();
let remote: FakeRemote | null = null;

const ctx = {
  options: null as { receiverApplicationId: string } | null,
  castState: 'NO_DEVICES_AVAILABLE',
  session: null as FakeSession | null,
  requests: 0,
  ended: 0,
  playPauses: 0,
  seeks: [] as number[],
  setOptions(options: { receiverApplicationId: string }): void {
    ctx.options = options;
  },
  addEventListener(type: string, fn: Listener): void {
    let set = listeners.get(type);
    if (set === undefined) {
      set = new Set();
      listeners.set(type, set);
    }
    set.add(fn);
  },
  getCastState: () => ctx.castState,
  getCurrentSession: () => ctx.session,
  requestSession: async (): Promise<void> => {
    ctx.requests += 1;
  },
  endCurrentSession: (): void => {
    ctx.ended += 1;
    endSession();
  },
};

const framework = {
  CastContext: { getInstance: () => ctx },
  RemotePlayer: class implements FakeRemote {
    isConnected = false;
    isMediaLoaded = false;
    isPaused = true;
    currentTime = 0;
    duration = 0;
    playerState: string | null = null;
    constructor() {
      remote = this;
    }
  },
  RemotePlayerController: class {
    addEventListener(_type: string, fn: () => void): void {
      remoteListeners.add(fn);
    }
    playOrPause(): void {
      ctx.playPauses += 1;
    }
    seek(): void {
      if (remote !== null) ctx.seeks.push(remote.currentTime);
    }
    stop(): void {}
  },
  CastContextEventType: { CAST_STATE_CHANGED: 'cast', SESSION_STATE_CHANGED: 'session' },
  CastState: {
    NO_DEVICES_AVAILABLE: 'NO_DEVICES_AVAILABLE',
    CONNECTING: 'CONNECTING',
    CONNECTED: 'CONNECTED',
  },
  SessionState: {
    SESSION_STARTED: 'SESSION_STARTED',
    SESSION_RESUMED: 'SESSION_RESUMED',
    SESSION_ENDED: 'SESSION_ENDED',
    SESSION_START_FAILED: 'SESSION_START_FAILED',
  },
  RemotePlayerEventType: { ANY_CHANGE: 'anyChanged' },
};

class MediaInfo {
  contentId: string;
  contentType: string;
  streamType = 'BUFFERED';
  tracks: unknown[] | null = null;
  constructor(contentId: string, contentType: string) {
    this.contentId = contentId;
    this.contentType = contentType;
  }
}

const chromeCast = {
  AutoJoinPolicy: { ORIGIN_SCOPED: 'origin_scoped' },
  media: {
    MediaInfo,
    LoadRequest: class {
      media: MediaInfo;
      currentTime = 0;
      autoplay = true;
      customData: unknown = null;
      constructor(media: MediaInfo) {
        this.media = media;
      }
    },
    Track: class {
      trackId: number;
      type: string;
      trackContentId = '';
      trackContentType = '';
      subtype = '';
      name = '';
      language = '';
      constructor(trackId: number, type: string) {
        this.trackId = trackId;
        this.type = type;
      }
    },
    TrackType: { TEXT: 'TEXT' },
    TextTrackType: { SUBTITLES: 'SUBTITLES', CAPTIONS: 'CAPTIONS' },
    StreamType: { BUFFERED: 'BUFFERED', LIVE: 'LIVE' },
  },
};

// Before any element connects: the helper reads these once.
const holder = globalThis as { cast?: unknown; chrome?: unknown };
holder.cast = { framework };
holder.chrome = { cast: chromeCast };

function fire(type: string, event: { sessionState?: string; castState?: string }): void {
  for (const fn of listeners.get(type) ?? []) fn(event);
}

/** A device appears on the network, or the last one goes. */
function devices(on: boolean): void {
  ctx.castState = on ? 'NOT_CONNECTED' : 'NO_DEVICES_AVAILABLE';
  fire('cast', { castState: ctx.castState });
}

/** The viewer picked `name` in the dialog: a session starts. */
function startSession(name = 'Living room'): FakeSession {
  const loads: CastLoadRequest[] = [];
  const session: FakeSession = {
    name,
    loads,
    contentId: undefined,
    getCastDevice: () => ({ friendlyName: name }),
    getMediaSession: () =>
      session.contentId === undefined ? null : { media: { contentId: session.contentId } },
    loadMedia: async (request) => {
      loads.push(request);
      session.contentId = request.media.contentId;
    },
  };
  ctx.session = session;
  ctx.castState = 'CONNECTED';
  fire('session', { sessionState: 'SESSION_STARTED' });
  return session;
}

function endSession(): void {
  ctx.session = null;
  ctx.castState = 'NOT_CONNECTED';
  fire('session', { sessionState: 'SESSION_ENDED' });
}

/** The receiver reports its playback. */
function report(fields: Partial<FakeRemote>): void {
  if (remote === null) throw new Error('no remote player yet');
  Object.assign(remote, { isConnected: true, isMediaLoaded: true }, fields);
  for (const fn of remoteListeners) fn();
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

interface Mounted {
  readonly player: MatteboxPlayerElement;
  readonly button: HTMLElement;
  readonly screen: HTMLElement;
  readonly inner: HTMLButtonElement;
}

/** A player under custom controls with the button in its bar and the screen beside the video. */
async function mount(
  handlers: readonly Handler[],
  src: string | null = silence(2),
): Promise<Mounted> {
  const player = new MatteboxPlayerElement({ handlers });
  player.setAttribute('controls', 'custom');
  player.setAttribute('muted', '');
  // A blob URL has no extension, so the type is the page's to give.
  player.setAttribute('type', 'audio/wav');
  const bar = document.createElement('mbx-control-bar');
  const button = document.createElement('mbx-cast-button');
  bar.append(button);
  const screen = document.createElement('mbx-cast-screen');
  player.append(screen, bar);
  const loaded = src === null ? Promise.resolve() : once(player, 'sourcechange');
  if (src !== null) player.setAttribute('src', src);
  document.body.append(player);
  await loaded;
  if (src !== null && player.video.readyState < HTMLMediaElement.HAVE_METADATA) {
    await once(player.video, 'loadedmetadata');
  }
  // The SDK resolves on a microtask; the context follows.
  await tick();
  await tick();
  const inner = button.shadowRoot?.querySelector('button');
  if (inner === null || inner === undefined) throw new Error('no button');
  return { player, button, screen, inner };
}

/** An engine session over a fake engine: the video plays the WAV itself, the engine only has to freeze. */
function engineHandler(live = false): { handler: Handler; engine: Record<string, unknown> } {
  const engine: Record<string, unknown> = {
    suspend: vi.fn(),
    resume: vi.fn(),
    // What the core reads of a session's engine: its error watch.
    on: () => () => undefined,
    error: null,
    stats: { snapshot: () => ({ presentation: null }) },
    ...(live ? { live: { edge: 10, latency: 2, atEdge: true, seekToEdge: () => {} } } : {}),
  };
  const handler: Handler = {
    name: 'fake-engine',
    canHandle: () => 'probably',
    handle: async (source, video): Promise<HandlerSession> => {
      video.src = source.url;
      return {
        handler: 'fake-engine',
        engine: engine as unknown as Mattebox,
        dispose: async () => {
          video.removeAttribute('src');
          video.load();
        },
      };
    },
  };
  return { handler, engine };
}

afterEach(() => {
  if (ctx.session !== null) endSession();
  ctx.castState = 'NO_DEVICES_AVAILABLE';
  ctx.requests = 0;
  ctx.ended = 0;
  ctx.playPauses = 0;
  ctx.seeks = [];
  if (remote !== null) {
    Object.assign(remote, {
      isConnected: false,
      isMediaLoaded: false,
      isPaused: true,
      currentTime: 0,
      duration: 0,
      playerState: null,
    });
  }
  document.body.replaceChildren();
});

describe('<mbx-cast-button>', () => {
  it('sets the context up with the default receiver, and hides until a device is there', async () => {
    const { button } = await mount([nativeHandler()]);
    expect(ctx.options?.receiverApplicationId).toBe('CC1AD845');
    expect(button.hidden).toBe(true);
    devices(true);
    expect(button.hidden).toBe(false);
    devices(false);
    expect(button.hidden).toBe(true);
  });

  it('is disabled without a source, and named', async () => {
    const { inner } = await mount([nativeHandler()], null);
    devices(true);
    expect(inner.disabled).toBe(true);
    expect(inner.getAttribute('aria-label')).toBe('Cast');
  });

  it('asks for a session on a click, then pauses the video and sends the source at its time', async () => {
    const { player, inner } = await mount([nativeHandler()]);
    devices(true);
    const video = player.video;
    video.currentTime = 1;
    await once(video, 'seeked');

    inner.click();
    expect(ctx.requests).toBe(1);
    expect(inner.hasAttribute('aria-busy')).toBe(true);

    const session = startSession();
    expect(video.paused).toBe(true);
    expect(player.hasAttribute('casting')).toBe(true);
    expect(inner.getAttribute('aria-label')).toBe('Stop casting');
    expect(session.loads).toHaveLength(1);
    const request = session.loads[0];
    expect(request?.media.contentId).toBe(player.getAttribute('src'));
    expect(request?.media.contentType).toBe('audio/wav');
    expect(request?.media.streamType).toBe('BUFFERED');
    expect(request?.currentTime).toBeCloseTo(1, 1);
    // The video was paused before the cast, so the receiver starts paused too.
    expect(request?.autoplay).toBe(false);
  });

  it('lets the page add customData through castload, or cancel it', async () => {
    const { player, button, inner } = await mount([nativeHandler()]);
    devices(true);
    button.addEventListener('castload', (event) => {
      (event as CustomEvent<CastLoadRequest>).detail.customData = { token: 'abc' };
    });
    inner.click();
    let session = startSession();
    expect(session.loads[0]?.customData).toEqual({ token: 'abc' });
    endSession();
    expect(player.hasAttribute('casting')).toBe(false);

    player.addEventListener('castload', (event) => {
      event.preventDefault();
    });
    inner.click();
    session = startSession();
    expect(session.loads).toHaveLength(0);
    // Cancelled or not, the session is the player's until it ends.
    expect(player.hasAttribute('casting')).toBe(true);
  });

  it("freezes the engine for the cast and thaws it after, at the receiver's time", async () => {
    const { handler, engine } = engineHandler();
    const { player, inner } = await mount([handler]);
    devices(true);
    const video = player.video;
    const play = vi.spyOn(video, 'play').mockResolvedValue();

    inner.click();
    startSession();
    expect(engine.suspend).toHaveBeenCalledTimes(1);
    expect(engine.resume).not.toHaveBeenCalled();

    report({ currentTime: 1.5, duration: 2, isPaused: false, playerState: 'PLAYING' });
    endSession();
    expect(engine.resume).toHaveBeenCalledTimes(1);
    expect(player.hasAttribute('casting')).toBe(false);
    expect(video.currentTime).toBeCloseTo(1.5, 1);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('sends a live stream as LIVE and does not seek the video when it ends', async () => {
    const { handler } = engineHandler(true);
    const { player, inner } = await mount([handler]);
    devices(true);
    const video = player.video;
    const play = vi.spyOn(video, 'play').mockResolvedValue();

    inner.click();
    const session = startSession();
    expect(session.loads[0]?.media.streamType).toBe('LIVE');

    report({ currentTime: 1.5, duration: 0, isPaused: true, playerState: 'PAUSED' });
    endSession();
    expect(video.currentTime).toBe(0);
    expect(play).not.toHaveBeenCalled();
  });

  it("sends the video's own subtitle tracks", async () => {
    const { player, inner } = await mount([nativeHandler()]);
    devices(true);
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.src = 'https://cdn.example/de.vtt';
    track.srclang = 'de';
    track.label = 'Deutsch';
    player.video.append(track);
    const chapters = document.createElement('track');
    chapters.kind = 'chapters';
    chapters.src = 'https://cdn.example/chapters.vtt';
    player.video.append(chapters);

    inner.click();
    const session = startSession();
    const tracks = session.loads[0]?.media.tracks;
    expect(tracks).toHaveLength(1);
    expect(tracks?.[0]).toMatchObject({
      trackContentId: 'https://cdn.example/de.vtt',
      trackContentType: 'text/vtt',
      subtype: 'SUBTITLES',
      name: 'Deutsch',
      language: 'de',
    });
  });

  it('ends the session on a second click', async () => {
    const { inner } = await mount([nativeHandler()]);
    devices(true);
    inner.click();
    startSession();
    inner.click();
    expect(ctx.ended).toBe(1);
  });
});

describe('<mbx-cast-screen>', () => {
  it("shows the receiver's name while casting and drives it", async () => {
    const { player, screen, inner } = await mount([nativeHandler()]);
    devices(true);
    expect(screen.hidden).toBe(true);

    inner.click();
    startSession('Kitchen');
    expect(screen.hidden).toBe(false);
    const root = screen.shadowRoot;
    expect(root?.querySelector('[part~="title"]')?.textContent).toBe('Casting to Kitchen');
    const play = root?.querySelector<HTMLButtonElement>('[part~="play"]');
    // Nothing loaded yet: the slider and the time wait for the receiver.
    expect(play?.disabled).toBe(true);
    expect(root?.querySelector<HTMLElement>('[part~="slider"]')?.hidden).toBe(true);

    report({ currentTime: 30, duration: 120, isPaused: false, playerState: 'PLAYING' });
    expect(play?.disabled).toBe(false);
    expect(play?.getAttribute('aria-label')).toBe('Pause');
    expect(root?.querySelector('[part~="time"]')?.textContent).toBe('0:30 / 2:00');
    const slider = root?.querySelector<HTMLElement>('[part~="slider"]');
    expect(slider?.hidden).toBe(false);
    expect(slider?.getAttribute('aria-valuenow')).toBe('30');
    expect(slider?.getAttribute('aria-valuemax')).toBe('120');

    play?.click();
    expect(ctx.playPauses).toBe(1);
    slider?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(ctx.seeks).toEqual([35]);

    root?.querySelector<HTMLButtonElement>('[part~="stop"]')?.click();
    expect(ctx.ended).toBe(1);
    expect(screen.hidden).toBe(true);
    expect(player.hasAttribute('casting')).toBe(false);
  });

  it('hides the slider and the time for a live stream, and takes the words the page gives', async () => {
    const { screen, inner } = await mount([nativeHandler()]);
    screen.setAttribute('label', 'Enviant a {device}');
    screen.setAttribute('label-stop', 'Atura');
    devices(true);
    inner.click();
    startSession('Sala');
    report({ currentTime: 5, duration: 0, isPaused: false, playerState: 'PLAYING' });
    const root = screen.shadowRoot;
    expect(root?.querySelector('[part~="title"]')?.textContent).toBe('Enviant a Sala');
    expect(root?.querySelector('[part~="stop"]')?.textContent).toBe('Atura');
    expect(root?.querySelector<HTMLElement>('[part~="slider"]')?.hidden).toBe(true);
    expect(root?.querySelector<HTMLElement>('[part~="time"]')?.hidden).toBe(true);
  });
});
