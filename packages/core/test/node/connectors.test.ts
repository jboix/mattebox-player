import type {
  Connector,
  Handler,
  HandlerSession,
  PlayerError,
  Programme,
  Resolution,
  Source,
} from '@mattebox/player-core';
import { Blocked, createPlayer } from '@mattebox/player-core';
import { describe, expect, it, vi } from 'vitest';

/** The chain is pure policy, so it runs without a DOM. */
const video = {
  canPlayType: () => '' as const,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  error: null,
} as unknown as HTMLMediaElement;

/** A handler that takes every source and records it. */
function taker(): { readonly handler: Handler; readonly seen: Source[] } {
  const seen: Source[] = [];
  const handler: Handler = {
    name: 'taker',
    canHandle: () => 'maybe',
    handle: async (source): Promise<HandlerSession> => {
      seen.push(source);
      return { handler: 'taker', engine: null, dispose: async () => undefined };
    },
    preload: vi.fn(async () => undefined),
  };
  return { handler, seen };
}

interface Episode {
  readonly title: string;
  readonly url?: string;
  readonly blocked?: string;
}

const EPISODE: Episode = { title: 'Episode', url: 'https://cdn.example/episode.m3u8' };

/** A connector over an in-memory catalogue, which counts its fetches. */
function catalogue(
  entries: Readonly<Record<string, Episode>> = { 'tv:1': EPISODE },
): Connector<Episode> & { fetches: string[] } {
  const fetches: string[] = [];
  return {
    type: 'example/tv',
    fetches,
    fetch: async (id) => {
      fetches.push(id);
      const entry = entries[id];
      if (entry === undefined) throw new Error(`no ${id}`);
      return entry;
    },
    resolve: (data): Resolution =>
      data.blocked !== undefined
        ? { sources: [], block: { message: data.blocked } }
        : {
            sources: data.url === undefined ? [] : [{ url: data.url }],
            metadata: { title: data.title },
          },
  };
}

function programmes(player: ReturnType<typeof createPlayer>): (Programme | null)[] {
  const seen: (Programme | null)[] = [];
  player.on('programme', (programme) => seen.push(programme));
  return seen;
}

function errors(player: ReturnType<typeof createPlayer>): PlayerError[] {
  const seen: PlayerError[] = [];
  player.on('error', (error) => seen.push(error));
  return seen;
}

describe('a connector source', () => {
  it('fetches by id, resolves, and plays the sources it resolved to', async () => {
    const { handler, seen } = taker();
    const connector = catalogue();
    const player = createPlayer(video, { handlers: [handler], connectors: [connector] });
    const fired = programmes(player);

    await player.load({ type: 'example/tv', id: 'tv:1' });

    expect(connector.fetches).toEqual(['tv:1']);
    expect(seen.map((source) => source.url)).toEqual(['https://cdn.example/episode.m3u8']);
    expect(fired).toHaveLength(1);
    expect(fired[0]).toMatchObject({
      type: 'example/tv',
      id: 'tv:1',
      data: EPISODE,
      metadata: { title: 'Episode' },
    });
    expect(player.programme).toBe(fired[0]);
  });

  it('resolves injected data without a fetch', async () => {
    const { handler, seen } = taker();
    const connector = catalogue();
    const player = createPlayer(video, { handlers: [handler], connectors: [connector] });

    const data: Episode = { title: 'Mine', url: 'https://cdn.example/mine.mpd' };
    await player.load({ type: 'example/tv', data });

    expect(connector.fetches).toEqual([]);
    expect(seen.map((source) => source.url)).toEqual(['https://cdn.example/mine.mpd']);
    expect(player.programme?.data).toBe(data);
  });

  it('takes a plain source of its type as an id, as the src and type attributes give it', async () => {
    const { handler } = taker();
    const connector = catalogue();
    const player = createPlayer(video, { handlers: [handler], connectors: [connector] });

    await player.load({ url: 'tv:1', type: 'example/tv' });

    expect(connector.fetches).toEqual(['tv:1']);
    expect(player.programme?.id).toBe('tv:1');
  });

  it('works for a connector without fetch, given data', async () => {
    const { handler, seen } = taker();
    const player = createPlayer(video, {
      handlers: [handler],
      connectors: [{ type: 'example/static', resolve: (url: string) => ({ sources: [{ url }] }) }],
    });

    await player.load({ type: 'example/static', data: 'https://cdn.example/s.mp4' });

    expect(seen.map((source) => source.url)).toEqual(['https://cdn.example/s.mp4']);
  });

  it('leaves a source of another type to the handlers as it is', async () => {
    const { handler, seen } = taker();
    const connector = catalogue();
    const player = createPlayer(video, { handlers: [handler], connectors: [connector] });

    await player.load({ url: 'https://cdn.example/plain.m3u8' });

    expect(connector.fetches).toEqual([]);
    expect(seen).toHaveLength(1);
    expect(player.programme).toMatchObject({
      sources: [{ url: 'https://cdn.example/plain.m3u8' }],
    });
    expect(player.programme?.type).toBeUndefined();
  });

  it('resolves each connector source of a list in its place', async () => {
    const { handler, seen } = taker();
    const player = createPlayer(video, {
      handlers: [handler],
      connectors: [
        {
          type: 'example/pair',
          resolve: (id: string) => ({
            sources: [
              { url: `https://a.example/${id}.mpd` },
              { url: `https://b.example/${id}.mpd` },
            ],
          }),
        },
      ],
    });

    await player.load([
      { url: 'https://first.example/v.m3u8' },
      { type: 'example/pair', data: 'x' },
    ]);

    // The first source plays; the rest are the fallback.
    expect(seen.map((source) => source.url)).toEqual(['https://first.example/v.m3u8']);
    expect(player.programme?.sources.map((source) => source.url)).toEqual([
      'https://first.example/v.m3u8',
      'https://a.example/x.mpd',
      'https://b.example/x.mpd',
    ]);
  });

  it('loads nothing for a blocked programme, and rejects with Blocked', async () => {
    const { handler, seen } = taker();
    const connector = catalogue({ 'tv:2': { title: 'Gone', blocked: 'Not here' } });
    const player = createPlayer(video, { handlers: [handler], connectors: [connector] });
    const fired = programmes(player);
    const reported = errors(player);

    const load = player.load({ type: 'example/tv', id: 'tv:2' });

    await expect(load).rejects.toBeInstanceOf(Blocked);
    await expect(load).rejects.toMatchObject({ block: { message: 'Not here' } });
    expect(seen).toHaveLength(0);
    expect(fired[0]?.block).toEqual({ message: 'Not here' });
    expect(reported).toHaveLength(0);
  });

  it('reports CONNECTOR_FAILED for a fetch that throws, after a programme without sources', async () => {
    const { handler, seen } = taker();
    const player = createPlayer(video, { handlers: [handler], connectors: [catalogue()] });
    const fired = programmes(player);
    const reported = errors(player);

    await expect(player.load({ type: 'example/tv', id: 'tv:9' })).rejects.toThrow();

    expect(seen).toHaveLength(0);
    expect(fired).toEqual([
      { given: [{ type: 'example/tv', id: 'tv:9' }], sources: [], type: 'example/tv', id: 'tv:9' },
    ]);
    expect(reported).toEqual([
      {
        category: 'connector',
        code: 'CONNECTOR_FAILED',
        fatal: true,
        recoverable: false,
        handler: null,
        context: { type: 'example/tv', id: 'tv:9', message: 'no tv:9' },
      },
    ]);
  });

  it('reports CONNECTOR_UNKNOWN for a type no connector takes', async () => {
    const { handler } = taker();
    const player = createPlayer(video, { handlers: [handler], connectors: [catalogue()] });
    const reported = errors(player);

    await expect(player.load({ type: 'example/radio', id: 'r:1' })).rejects.toThrow();

    expect(reported.map((error) => error.code)).toEqual(['CONNECTOR_UNKNOWN']);
  });

  it('reports CONNECTOR_NO_SOURCE for a resolution with neither sources nor a block', async () => {
    const { handler } = taker();
    const connector = catalogue({ 'tv:3': { title: 'Empty' } });
    const player = createPlayer(video, { handlers: [handler], connectors: [connector] });
    const reported = errors(player);

    await expect(player.load({ type: 'example/tv', id: 'tv:3' })).rejects.toThrow();

    expect(reported.map((error) => error.code)).toEqual(['CONNECTOR_NO_SOURCE']);
  });

  it('aborts the fetch of a load that a later load replaces, and reports nothing for it', async () => {
    const { handler, seen } = taker();
    let aborted = false;
    let started: () => void = () => undefined;
    const fetching = new Promise<void>((resolve) => {
      started = resolve;
    });
    const slow: Connector<string> = {
      type: 'example/slow',
      fetch: (id, signal) =>
        new Promise((resolve, reject) => {
          started();
          signal.addEventListener('abort', () => {
            aborted = true;
            reject(new Error('aborted'));
          });
          setTimeout(() => resolve(id), 1000);
        }),
      resolve: (url) => ({ sources: [{ url }] }),
    };
    const player = createPlayer(video, { handlers: [handler], connectors: [slow] });
    const reported = errors(player);
    const fired = programmes(player);

    const first = player.load({ type: 'example/slow', id: 'https://cdn.example/old.mpd' });
    await fetching;
    const second = player.load({ url: 'https://cdn.example/new.mpd' });

    await expect(first).rejects.toThrow();
    await second;
    expect(aborted).toBe(true);
    expect(reported).toHaveLength(0);
    expect(seen.map((source) => source.url)).toEqual(['https://cdn.example/new.mpd']);
    expect(fired.map((programme) => programme?.sources[0]?.url)).toEqual([
      'https://cdn.example/new.mpd',
    ]);
  });

  it('fires programme null at unload', async () => {
    const { handler } = taker();
    const player = createPlayer(video, { handlers: [handler], connectors: [catalogue()] });
    const fired = programmes(player);

    await player.load({ type: 'example/tv', id: 'tv:1' });
    await player.unload();

    expect(fired.at(-1)).toBeNull();
    expect(player.programme).toBeNull();
  });

  it('preload resolves a connector source, and the load takes it without a second fetch', async () => {
    const { handler, seen } = taker();
    const connector = catalogue();
    const player = createPlayer(video, { handlers: [handler], connectors: [connector] });

    await player.preload({ type: 'example/tv', id: 'tv:1' });

    expect(connector.fetches).toEqual(['tv:1']);
    expect(handler.preload).toHaveBeenCalledWith(
      expect.objectContaining({ url: EPISODE.url }),
      undefined,
    );
    expect(player.preloaded?.metadata?.title).toBe('Episode');
    await player.load({ type: 'example/tv', id: 'tv:1' });
    expect(connector.fetches).toEqual(['tv:1']);
    expect(seen.map((source) => source.url)).toEqual([EPISODE.url]);
    expect(player.programme?.metadata?.title).toBe('Episode');
    // Kept once: the next load asks the connector again.
    await player.load({ type: 'example/tv', id: 'tv:1' });
    expect(connector.fetches).toEqual(['tv:1', 'tv:1']);
  });

  it('takes a preload of the same data, and of a plain source of the type, by its id', async () => {
    const { handler } = taker();
    const connector = catalogue();
    const resolve = vi.spyOn(connector, 'resolve');
    const player = createPlayer(video, { handlers: [handler], connectors: [connector] });

    const data = { title: 'Given', url: 'https://cdn.example/given.m3u8' };
    await player.preload({ type: 'example/tv', data });
    await player.load({ type: 'example/tv', data });
    expect(resolve).toHaveBeenCalledTimes(1);

    await player.preload({ url: 'tv:1', type: 'example/tv' });
    await player.load({ type: 'example/tv', id: 'tv:1' });
    expect(connector.fetches).toEqual(['tv:1']);
  });

  it('asks the connector again for another programme, after keepSeconds, or after a failed preload', async () => {
    const { handler } = taker();
    let calls = 0;
    const connector = catalogue({ 'tv:1': EPISODE, 'tv:2': EPISODE });
    const fetch = connector.fetch?.bind(connector);
    connector.fetch = async (id, signal) => {
      calls += 1;
      // The first request fails, as a network can.
      if (calls === 1) throw new Error('offline');
      return (fetch as NonNullable<typeof fetch>)(id, signal);
    };
    const player = createPlayer(video, { handlers: [handler], connectors: [connector] });
    const failed = errors(player);

    await player.preload({ type: 'example/tv', id: 'tv:1' });
    await player.load({ type: 'example/tv', id: 'tv:1' });
    expect(calls).toBe(2);
    expect(failed).toEqual([]);

    await player.preload({ type: 'example/tv', id: 'tv:1' });
    await player.load({ type: 'example/tv', id: 'tv:2' });
    expect(calls).toBe(4);

    await player.preload({ type: 'example/tv', id: 'tv:1' }, { keepSeconds: -1 });
    await player.load({ type: 'example/tv', id: 'tv:1' });
    expect(calls).toBe(6);
  });

  it('preloads nothing of a blocked programme, and says the block in preloaded', async () => {
    const { handler } = taker();
    const connector = catalogue({ 'tv:9': { title: 'Nine', blocked: 'Not here.' } });
    const player = createPlayer(video, { handlers: [handler], connectors: [connector] });

    await player.preload({ type: 'example/tv', id: 'tv:9' });

    expect(handler.preload).not.toHaveBeenCalled();
    expect(player.preloaded?.block).toEqual({ message: 'Not here.' });
  });

  it('preloads plain sources as they are', async () => {
    const { handler } = taker();
    const connector = catalogue();
    const player = createPlayer(video, { handlers: [handler], connectors: [connector] });

    await player.preload([
      { url: 'https://cdn.example/n.mpd' },
      { type: 'example/tv', id: 'tv:1' },
    ]);

    expect(connector.fetches).toEqual([]);
    expect(handler.preload).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://cdn.example/n.mpd' }),
      undefined,
    );
  });
});
