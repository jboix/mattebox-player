import type {
  CanHandle,
  Handler,
  HandlerSession,
  PlayerError,
  Session,
  Source,
} from '@mattebox/player-core';
import { createPlayer, Declined, nativeHandler, preferNativeHls } from '@mattebox/player-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** The chain is pure policy, so it runs without a DOM. */
const video = {
  canPlayType: () => '' as const,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  error: null,
} as unknown as HTMLMediaElement;

interface Stub {
  readonly handler: Handler;
  readonly seen: Source[];
  readonly disposed: string[];
}

function stub(
  name: string,
  answer: CanHandle,
  options: { readonly declines?: boolean; readonly delay?: number } = {},
): Stub {
  const seen: Source[] = [];
  const disposed: string[] = [];
  const handler: Handler = {
    name,
    canHandle: (source) => {
      seen.push(source);
      return answer;
    },
    handle: async (): Promise<HandlerSession> => {
      if (options.delay !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, options.delay));
      }
      if (options.declines === true) throw new Declined('MANIFEST_UNSUPPORTED');
      return {
        handler: name,
        engine: null,
        dispose: async () => {
          disposed.push(name);
        },
      };
    },
  };
  return { handler, seen, disposed };
}

describe('createPlayer', () => {
  it('adds the resolved source to the session, type inferred', async () => {
    const stub_ = stub('a', 'maybe');
    const player = createPlayer(video, { handlers: [stub_.handler] });
    const session = await player.load({ url: 'https://cdn.example/v.m3u8' });
    expect(session.source).toEqual({
      url: 'https://cdn.example/v.m3u8',
      type: 'application/vnd.apple.mpegurl',
    });
    expect(player.session?.source).toBe(session.source);
  });

  it('takes the first non-empty answer, so a later probably loses to an earlier maybe', async () => {
    const first = stub('first', 'maybe');
    const second = stub('second', 'probably');
    const player = createPlayer(video, { handlers: [first.handler, second.handler] });

    const session = await player.load({ url: 'https://cdn.example/stream/12345' });

    expect(session.handler).toBe('first');
    expect(second.seen).toHaveLength(0);
  });

  it('skips a handler that declines the source and reports nothing for it', async () => {
    const first = stub('first', 'probably', { declines: true });
    const second = stub('second', 'maybe');
    const player = createPlayer(video, { handlers: [first.handler, second.handler] });
    const errors: PlayerError[] = [];
    player.on('error', (error) => errors.push(error));

    const session = await player.load({ url: 'https://cdn.example/a.m3u8' });

    expect(session.handler).toBe('second');
    expect(errors).toHaveLength(0);
  });

  it('resolves the type from the extension before the handlers see it', async () => {
    const only = stub('only', 'probably');
    const player = createPlayer(video, { handlers: [only.handler] });

    await player.load({ url: 'https://cdn.example/vod/master.m3u8' });
    await player.load({ url: 'https://cdn.example/stream/12345' });

    expect(only.seen[0]?.type).toBe('application/vnd.apple.mpegurl');
    expect(only.seen[1]?.type).toBeUndefined();
  });

  it('keeps an explicit type over the extension', async () => {
    const only = stub('only', 'probably');
    const player = createPlayer(video, { handlers: [only.handler] });

    await player.load({ url: 'https://cdn.example/clip.mp4', type: 'application/dash+xml' });

    expect(only.seen[0]?.type).toBe('application/dash+xml');
  });

  it('reports MANIFEST_UNSUPPORTED and rejects when no handler claims the source', async () => {
    const none = stub('none', '');
    const player = createPlayer(video, { handlers: [none.handler] });
    const errors: PlayerError[] = [];
    player.on('error', (error) => errors.push(error));

    await expect(player.load({ url: 'https://cdn.example/clip.mkv' })).rejects.toThrow(
      'no handler',
    );
    expect(errors).toEqual([
      {
        category: 'manifest',
        code: 'MANIFEST_UNSUPPORTED',
        fatal: true,
        recoverable: false,
        handler: null,
        context: { url: 'https://cdn.example/clip.mkv' },
      },
    ]);
  });

  it('disposes the current session before loading another', async () => {
    const only = stub('only', 'probably');
    const player = createPlayer(video, { handlers: [only.handler] });
    const changes: Array<Session | null> = [];
    player.on('sourcechange', (session) => changes.push(session));

    await player.load({ url: 'https://cdn.example/a.mp4' });
    expect(only.disposed).toEqual([]);
    await player.load({ url: 'https://cdn.example/b.mp4' });

    expect(only.disposed).toEqual(['only']);
    expect(changes).toHaveLength(2);
  });

  it('settles two loads in order and lets the later one win', async () => {
    const slow = stub('slow', 'probably', { delay: 20 });
    const player = createPlayer(video, { handlers: [slow.handler] });
    const changes: Array<Session | null> = [];
    player.on('sourcechange', (session) => changes.push(session));
    const order: string[] = [];

    const first = player.load({ url: 'https://cdn.example/a.mp4' }).then(() => order.push('a'));
    const second = player.load({ url: 'https://cdn.example/b.mp4' }).then(() => order.push('b'));
    await Promise.all([first, second]);

    expect(order).toEqual(['a', 'b']);
    // The superseded load never became the session, and disposed itself.
    expect(changes).toHaveLength(1);
    expect(slow.disposed).toEqual(['slow']);
    expect(player.session?.handler).toBe('slow');
  });

  it('unload disposes the session and reports the change as null', async () => {
    const only = stub('only', 'probably');
    const player = createPlayer(video, { handlers: [only.handler] });
    const changes: Array<Session | null> = [];
    player.on('sourcechange', (session) => changes.push(session));

    await player.load({ url: 'https://cdn.example/a.mp4' });
    await player.unload();

    expect(only.disposed).toEqual(['only']);
    expect(player.session).toBeNull();
    expect(changes[1]).toBeNull();
  });

  it('on returns an unsubscribe', async () => {
    const only = stub('only', 'probably');
    const player = createPlayer(video, { handlers: [only.handler] });
    const seen = vi.fn();
    const off = player.on('sourcechange', seen);
    off();

    await player.load({ url: 'https://cdn.example/a.mp4' });

    expect(seen).not.toHaveBeenCalled();
  });

  it('asks a handler that prefers the source first, whatever its place', async () => {
    const engine = stub('engine', 'probably');
    const native = stub('native', 'maybe');
    const preferring: Handler = {
      ...native.handler,
      prefers: (source) => source.type === 'application/vnd.apple.mpegurl',
    };
    const player = createPlayer(video, { handlers: [engine.handler, preferring] });

    expect((await player.load({ url: 'https://cdn.example/a.m3u8' })).handler).toBe('native');
    expect(engine.seen).toHaveLength(0);
    // Another type keeps the page's order.
    expect((await player.load({ url: 'https://cdn.example/a.mpd' })).handler).toBe('engine');
  });

  it('falls back to the page order when the preferred handler cannot play the source', async () => {
    const engine = stub('engine', 'probably');
    const native = stub('native', '');
    const preferring: Handler = { ...native.handler, prefers: () => true };
    const player = createPlayer(video, { handlers: [engine.handler, preferring] });

    expect((await player.load({ url: 'https://cdn.example/a.m3u8' })).handler).toBe('engine');
    expect(native.seen).toHaveLength(1);
  });
});

describe('a native session with DRM attached', () => {
  it('reports the attachment errors on the error event, until the session ends', async () => {
    let fire: ((payload: unknown) => void) | null = null;
    const handler: Handler = {
      name: 'native',
      canHandle: () => 'maybe',
      handle: async () => ({
        handler: 'native',
        engine: null,
        eme: {
          drm: { keySystem: null, sessions: [], setLicenseUrl: () => undefined },
          on: (_event: string, fn: (payload: unknown) => void) => {
            fire = fn;
            return () => {
              fire = null;
            };
          },
          detach: () => undefined,
        },
        dispose: async () => undefined,
      }),
    };
    const player = createPlayer(video, { handlers: [handler] });
    const errors: PlayerError[] = [];
    player.on('error', (error) => errors.push(error));
    await player.load({ url: 'https://cdn.example/a.m3u8' });

    (fire as ((payload: unknown) => void) | null)?.({
      category: 'drm',
      code: 'DRM_LICENSE_FAILED',
      fatal: true,
      recoverable: false,
    });
    expect(errors.map((error) => [error.code, error.handler])).toEqual([
      ['DRM_LICENSE_FAILED', 'native'],
    ]);

    await player.unload();
    expect(fire).toBeNull();
  });
});

describe('preferNativeHls', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** A video that answers `canPlayType` for HLS the way Safari does, or not at all. */
  function element(hls: boolean): HTMLMediaElement {
    return {
      canPlayType: (type: string) =>
        hls && type === 'application/vnd.apple.mpegurl' ? 'maybe' : '',
    } as unknown as HTMLMediaElement;
  }

  const HLS: Source = { url: 'a.m3u8', type: 'application/vnd.apple.mpegurl' };
  const DASH: Source = { url: 'a.mpd', type: 'application/dash+xml' };

  it('prefers HLS on Apple WebKit when the element plays it', () => {
    vi.stubGlobal('navigator', { vendor: 'Apple Computer, Inc.' });
    expect(preferNativeHls(HLS, { video: element(true), mse: true })).toBe(true);
    expect(
      preferNativeHls(
        { url: 'a', type: 'application/x-mpegURL' },
        { video: element(true), mse: true },
      ),
    ).toBe(true);
  });

  it('keeps DASH, an untyped source, and an element without HLS on the engine', () => {
    vi.stubGlobal('navigator', { vendor: 'Apple Computer, Inc.' });
    expect(preferNativeHls(DASH, { video: element(true), mse: true })).toBe(false);
    expect(preferNativeHls({ url: 'signed/1' }, { video: element(true), mse: true })).toBe(false);
    expect(preferNativeHls(HLS, { video: element(false), mse: true })).toBe(false);
  });

  it('keeps Android Chrome on the engine, though it answers canPlayType for HLS', () => {
    vi.stubGlobal('navigator', { vendor: 'Google Inc.' });
    expect(preferNativeHls(HLS, { video: element(true), mse: true })).toBe(false);
  });

  it('is what nativeHandler offers as prefers, and nothing without the option', () => {
    const prefer = (): boolean => true;
    expect(nativeHandler({ prefer }).prefers).toBe(prefer);
    expect(nativeHandler().prefers).toBeUndefined();
  });
});
