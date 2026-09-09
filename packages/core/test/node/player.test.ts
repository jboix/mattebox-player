import type { CanHandle, Handler, PlayerError, Session, Source } from '@mattebox/player-core';
import { createPlayer, Declined } from '@mattebox/player-core';
import { describe, expect, it, vi } from 'vitest';

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
    handle: async (): Promise<Session> => {
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
});
