import type { Handler, HandlerSession, PlayerError, Session, Source } from '@mattebox/player-core';
import { createPlayer, matteboxHandler, nativeHandler } from '@mattebox/player-core';
import type { Preset } from 'mattebox/presets/full';
import { describe, expect, it, vi } from 'vitest';

const HLS: Source = { url: 'https://cdn.example/a.m3u8', type: 'application/vnd.apple.mpegurl' };
const DASH: Source = { url: 'https://cdn.example/a.mpd', type: 'application/dash+xml' };
const MP4: Source = { url: 'https://cdn.example/a.mp4', type: 'video/mp4' };

const FATAL = { category: 'network', code: 'NETWORK_HTTP_STATUS', fatal: true, recoverable: false };

/** A video with the two events the core listens to, and a play it can count. */
function fakeVideo() {
  const listeners = new Map<string, Set<() => void>>();
  const video = {
    paused: true,
    error: null,
    play: vi.fn(async () => undefined),
    canPlayType: () => '',
    addEventListener: (name: string, fn: () => void) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)?.add(fn);
    },
    removeEventListener: (name: string, fn: () => void) => {
      listeners.get(name)?.delete(fn);
    },
  };
  const fire = (name: string): void => {
    for (const fn of [...(listeners.get(name) ?? [])]) fn();
  };
  return { video: video as unknown as HTMLMediaElement, state: video, fire };
}

/**
 * A handler whose sessions carry a stand-in engine: `fire` raises an error
 * on the session of a URL, and `pending` names the URLs that already hold a
 * fatal error when `handle` returns.
 */
function engines(types: readonly string[], pending: readonly string[] = []) {
  const emitters = new Map<string, (payload: unknown) => void>();
  const handled: string[] = [];
  const disposed: string[] = [];
  const handler: Handler = {
    name: 'engine',
    canHandle: (source) => (types.includes(source.type ?? '') ? 'probably' : ''),
    handle: async (source): Promise<HandlerSession> => {
      handled.push(source.url);
      const engine = {
        error: pending.includes(source.url) ? FATAL : null,
        on: (_event: string, fn: (payload: unknown) => void) => {
          emitters.set(source.url, fn);
          return () => {
            emitters.delete(source.url);
          };
        },
      };
      return {
        handler: 'engine',
        engine: engine as unknown as HandlerSession['engine'],
        dispose: async () => {
          disposed.push(source.url);
        },
      };
    },
  };
  const fire = (url: string, payload: unknown): void => emitters.get(url)?.(payload);
  return { handler, handled, disposed, fire };
}

function observe(player: ReturnType<typeof createPlayer>) {
  const errors: PlayerError[] = [];
  const sessions: Array<Session | null> = [];
  player.on('error', (error) => errors.push(error));
  player.on('sourcechange', (session) => sessions.push(session));
  const summary = (): Array<[string, boolean, string | undefined]> =>
    errors.map((error) => [error.code, error.fatal, error.source?.url]);
  return { errors, sessions, summary };
}

describe('a list of sources', () => {
  it('passes over a source no handler takes, and never asks a handler to play it', async () => {
    const { video } = fakeVideo();
    const chain = engines([DASH.type as string]);
    const player = createPlayer(video, { handlers: [chain.handler] });
    const seen = observe(player);

    const session = await player.load([HLS, DASH]);

    expect(session.source).toEqual(DASH);
    expect(chain.handled).toEqual([DASH.url]);
    expect(seen.summary()).toEqual([['MANIFEST_UNSUPPORTED', false, HLS.url]]);
  });

  it('moves to the next source on a fatal error before the first playing event', async () => {
    const { video } = fakeVideo();
    const chain = engines([HLS.type as string, DASH.type as string]);
    const player = createPlayer(video, { handlers: [chain.handler] });
    const seen = observe(player);

    const first = await player.load([HLS, DASH]);
    chain.fire(HLS.url, { category: 'drm', code: 'DRM_KEY_SYSTEM_UNAVAILABLE', fatal: true });
    await vi.waitFor(() => expect(player.session?.source).toEqual(DASH));

    expect(first.source).toEqual(HLS);
    expect(chain.disposed).toEqual([HLS.url]);
    expect(seen.sessions.map((session) => session?.source.url)).toEqual([HLS.url, DASH.url]);
    expect(seen.summary()).toEqual([['DRM_KEY_SYSTEM_UNAVAILABLE', false, HLS.url]]);
  });

  it('keeps the source after the first playing event, and reports its error as fatal', async () => {
    const { video, fire } = fakeVideo();
    const chain = engines([HLS.type as string, DASH.type as string]);
    const player = createPlayer(video, { handlers: [chain.handler] });
    const seen = observe(player);

    await player.load([HLS, DASH]);
    fire('playing');
    chain.fire(HLS.url, FATAL);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(player.session?.source).toEqual(HLS);
    expect(chain.handled).toEqual([HLS.url]);
    expect(seen.summary()).toEqual([['NETWORK_HTTP_STATUS', true, undefined]]);
  });

  it('reports the error of the last source as fatal', async () => {
    const { video } = fakeVideo();
    const chain = engines([HLS.type as string, DASH.type as string]);
    const player = createPlayer(video, { handlers: [chain.handler] });
    const seen = observe(player);

    await player.load([HLS, DASH]);
    chain.fire(HLS.url, FATAL);
    await vi.waitFor(() => expect(player.session?.source).toEqual(DASH));
    chain.fire(DASH.url, FATAL);

    expect(seen.summary()).toEqual([
      ['NETWORK_HTTP_STATUS', false, HLS.url],
      ['NETWORK_HTTP_STATUS', true, undefined],
    ]);
    expect(player.session?.source).toEqual(DASH);
  });

  it('stays on the source for an error that is not fatal', async () => {
    const { video } = fakeVideo();
    const chain = engines([HLS.type as string, DASH.type as string]);
    const player = createPlayer(video, { handlers: [chain.handler] });
    const seen = observe(player);

    await player.load([HLS, DASH]);
    chain.fire(HLS.url, { ...FATAL, fatal: false });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(player.session?.source).toEqual(HLS);
    expect(seen.summary()).toEqual([['NETWORK_HTTP_STATUS', false, undefined]]);
  });

  it('moves on from a source whose engine already holds a fatal error', async () => {
    const { video } = fakeVideo();
    const chain = engines([HLS.type as string, DASH.type as string], [HLS.url]);
    const player = createPlayer(video, { handlers: [chain.handler] });
    const seen = observe(player);

    await player.load([HLS, DASH]);
    await vi.waitFor(() => expect(player.session?.source).toEqual(DASH));

    expect(seen.summary()).toEqual([['NETWORK_HTTP_STATUS', false, HLS.url]]);
  });

  it('skips one source for two fatal errors of the same session', async () => {
    const { video } = fakeVideo();
    const chain = engines([HLS.type as string, DASH.type as string, MP4.type as string]);
    const player = createPlayer(video, { handlers: [chain.handler] });
    observe(player);

    await player.load([HLS, DASH, MP4]);
    const raise = (payload: unknown): void => chain.fire(HLS.url, payload);
    raise(FATAL);
    raise(FATAL);
    await vi.waitFor(() => expect(player.session?.source).toEqual(DASH));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(chain.handled).toEqual([HLS.url, DASH.url]);
  });

  it('ends with a fatal error when no handler takes the sources that are left', async () => {
    const { video } = fakeVideo();
    const chain = engines([HLS.type as string]);
    const player = createPlayer(video, { handlers: [chain.handler] });
    const seen = observe(player);

    await player.load([HLS, DASH, MP4]);
    chain.fire(HLS.url, FATAL);
    await vi.waitFor(() => expect(seen.errors).toHaveLength(3));

    expect(seen.summary()).toEqual([
      ['NETWORK_HTTP_STATUS', false, HLS.url],
      ['MANIFEST_UNSUPPORTED', false, DASH.url],
      ['MANIFEST_UNSUPPORTED', true, undefined],
    ]);
    expect(player.session).toBeNull();
  });

  it('plays again on the next source when the video was not paused', async () => {
    const { video, state } = fakeVideo();
    const chain = engines([HLS.type as string, DASH.type as string]);
    const player = createPlayer(video, { handlers: [chain.handler] });

    await player.load([HLS, DASH]);
    state.paused = false;
    chain.fire(HLS.url, FATAL);
    await vi.waitFor(() => expect(state.play).toHaveBeenCalledTimes(1));

    expect(player.session?.source).toEqual(DASH);
  });

  it('leaves a paused video paused on the next source', async () => {
    const { video, state } = fakeVideo();
    const chain = engines([HLS.type as string, DASH.type as string]);
    const player = createPlayer(video, { handlers: [chain.handler] });

    await player.load([HLS, DASH]);
    chain.fire(HLS.url, FATAL);
    await vi.waitFor(() => expect(player.session?.source).toEqual(DASH));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(state.play).not.toHaveBeenCalled();
  });

  it('drops the next source when the page loads something else first', async () => {
    const { video } = fakeVideo();
    const chain = engines([HLS.type as string, DASH.type as string, MP4.type as string]);
    const player = createPlayer(video, { handlers: [chain.handler] });

    await player.load([HLS, DASH]);
    chain.fire(HLS.url, FATAL);
    await player.load(MP4);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(chain.handled).toEqual([HLS.url, MP4.url]);
    expect(player.session?.source).toEqual(MP4);
  });

  it('rejects an empty list', async () => {
    const { video } = fakeVideo();
    const player = createPlayer(video, { handlers: [engines([]).handler] });
    await expect(player.load([])).rejects.toThrow('no handler');
  });
});

describe('the DRM of a source', () => {
  it('reaches the engine after the attach and before the load', async () => {
    const log: string[] = [];
    const engine = {
      accepts: () => true,
      attach: async () => {
        log.push('attach');
      },
      load: () => {
        log.push('load');
      },
      on: () => () => undefined,
      stats: { snapshot: () => ({ lifecycle: { phase: 'ready' } }) },
      drm: {
        setLicenseUrl: (url: string) => log.push(`license ${url}`),
        setLicenseUrls: (urls: Record<string, string>) => log.push(`licenses ${Object.keys(urls)}`),
        setCertificateUrl: (url: string) => log.push(`certificate ${url}`),
      },
    };
    const handler = matteboxHandler({ preset: (() => engine) as unknown as Preset });
    const { video } = fakeVideo();

    await handler.handle(
      {
        ...DASH,
        drm: {
          licenseUrl: 'https://drm.example/one',
          licenseUrls: { 'com.widevine.alpha': 'https://drm.example/widevine' },
          certificateUrl: 'https://drm.example/fps.cer',
        },
      },
      video,
    );

    expect(log).toEqual([
      'attach',
      'license https://drm.example/one',
      'licenses com.widevine.alpha',
      'certificate https://drm.example/fps.cer',
      'load',
    ]);
  });

  it('sets nothing on the engine for a source without it', async () => {
    const calls: string[] = [];
    const engine = {
      attach: async () => undefined,
      load: () => undefined,
      on: () => () => undefined,
      stats: { snapshot: () => ({ lifecycle: { phase: 'ready' } }) },
      drm: { setLicenseUrl: () => calls.push('license') },
    };
    const handler = matteboxHandler({ preset: (() => engine) as unknown as Preset });

    await handler.handle(DASH, fakeVideo().video);

    expect(calls).toEqual([]);
  });

  it('attaches DRM to a native session that has no option of its own', async () => {
    const video = {
      disableRemotePlayback: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      set src(_url: string) {},
    } as unknown as HTMLMediaElement;

    const plain = await nativeHandler().handle(HLS, video);
    const own = await nativeHandler().handle(
      { ...HLS, drm: { licenseUrl: 'https://drm.example/fps' } },
      video,
    );

    expect(plain.eme).toBeUndefined();
    expect(own.eme).toBeDefined();
  });
});

describe('preload', () => {
  /** A handler for one type that records what it was asked to preload. */
  function preloader(type: string, fails = false) {
    const asked: Array<[string, unknown]> = [];
    const handler: Handler = {
      name: type,
      canHandle: (source) => (source.type === type ? 'probably' : ''),
      handle: async () => ({ handler: type, engine: null, dispose: async () => undefined }),
      preload: async (source, options) => {
        asked.push([source.url, options]);
        if (fails) throw new Error('no network');
      },
    };
    return { handler, asked };
  }

  it('asks the handler that would play the source, with the options', async () => {
    const hls = preloader(HLS.type as string);
    const dash = preloader(DASH.type as string);
    const player = createPlayer(fakeVideo().video, { handlers: [hls.handler, dash.handler] });

    await player.preload({ url: DASH.url }, { segments: 2 });

    expect(hls.asked).toEqual([]);
    expect(dash.asked).toEqual([[DASH.url, { segments: 2 }]]);
  });

  it('preloads the first source of a list a handler takes', async () => {
    const dash = preloader(DASH.type as string);
    const player = createPlayer(fakeVideo().video, { handlers: [dash.handler] });

    await player.preload([HLS, DASH, { ...DASH, url: 'https://cdn.example/b.mpd' }]);

    expect(dash.asked.map(([url]) => url)).toEqual([DASH.url]);
  });

  it('does nothing for a handler without preload, and never rejects', async () => {
    const plain = engines([HLS.type as string]);
    const failing = preloader(DASH.type as string, true);
    const player = createPlayer(fakeVideo().video, {
      handlers: [plain.handler, failing.handler],
    });

    await expect(player.preload(HLS)).resolves.toBeUndefined();
    await expect(player.preload(DASH)).resolves.toBeUndefined();
    await expect(player.preload(MP4)).resolves.toBeUndefined();
    expect(plain.handled).toEqual([]);
  });

  it('reaches the engine of the mattebox handler with the type and the options', async () => {
    const asked: unknown[] = [];
    const engine = {
      accepts: () => true,
      preload: async (url: string, options: unknown) => {
        asked.push([url, options]);
      },
    };
    const handler = matteboxHandler({ preset: (() => engine) as unknown as Preset });

    await handler.preload?.(DASH, { segments: 1, keepSeconds: 60 });

    expect(asked).toEqual([
      [DASH.url, { segments: 1, keepSeconds: 60, mimeType: 'application/dash+xml' }],
    ]);
  });
});
