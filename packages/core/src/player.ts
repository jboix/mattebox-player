/**
 * The chain runner. One player per element, like an engine: no globals, no
 * registry. Handlers run in order and the first non-empty `canHandle` wins,
 * with the three-tier answer of `canPlayType`. A `probably` from a later
 * handler does not beat a `maybe` from an earlier one, because the order is
 * the integrator's policy, not a ranking.
 */
import { Declined, fromEngineError, fromMediaError } from './errors.js';
import { inferType } from './infer-type.js';
import type {
  HandlerEnvironment,
  Player,
  PlayerError,
  PlayerEvent,
  PlayerEvents,
  PlayerOptions,
  Session,
  Source,
} from './types.js';

/** What the core reports when no handler claimed the source. */
function unclaimed(source: Source): PlayerError {
  return {
    category: 'manifest',
    code: 'MANIFEST_UNSUPPORTED',
    fatal: true,
    recoverable: false,
    handler: null,
    context:
      source.type === undefined ? { url: source.url } : { url: source.url, mimeType: source.type },
  };
}

export function createPlayer(video: HTMLMediaElement, options: PlayerOptions): Player {
  const listeners: { readonly [E in PlayerEvent]: Set<(payload: PlayerEvents[E]) => void> } = {
    sourcechange: new Set(),
    error: new Set(),
  };
  let current: Session | null = null;
  /** Bumped by every load and by unload. A load whose number is stale lost. */
  let generation = 0;
  /** Loads run one at a time, so they settle in the order they were called. */
  let queue: Promise<unknown> = Promise.resolve();
  let unwatch: (() => void) | null = null;

  function emit<E extends PlayerEvent>(event: E, payload: PlayerEvents[E]): void {
    const set = listeners[event] as Set<(payload: PlayerEvents[E]) => void>;
    for (const fn of [...set]) fn(payload);
  }

  /**
   * One error subscription per session. An engine reports the element's
   * `MediaError` itself, so a session with an engine is never watched twice.
   */
  function watch(session: Session): () => void {
    if (session.engine !== null) {
      return session.engine.on('error', (payload) => {
        const error = fromEngineError(payload, session.handler);
        if (error !== null) emit('error', error);
      });
    }
    const onError = (): void => {
      const error = fromMediaError(video, session.handler);
      if (error !== null) emit('error', error);
    };
    video.addEventListener('error', onError);
    return () => {
      video.removeEventListener('error', onError);
    };
  }

  async function release(): Promise<void> {
    const session = current;
    current = null;
    unwatch?.();
    unwatch = null;
    if (session !== null) await session.dispose();
  }

  async function run(source: Source, mine: number): Promise<Session> {
    await release();

    const type = source.type ?? inferType(source.url);
    const resolved: Source = type === undefined ? { url: source.url } : { url: source.url, type };
    const env: HandlerEnvironment = {
      video,
      mse: 'MediaSource' in globalThis || 'ManagedMediaSource' in globalThis,
    };

    for (const handler of options.handlers) {
      if (handler.canHandle(resolved, env) === '') continue;
      let session: Session;
      try {
        session = await handler.handle(resolved, video);
      } catch (cause) {
        // The handler claimed the source and then found it was not its own.
        if (cause instanceof Declined) continue;
        throw cause;
      }
      if (mine !== generation) {
        // A later load was called while this one ran. It wins, so this
        // session is disposed and never becomes `player.session`.
        await session.dispose();
        return session;
      }
      current = session;
      unwatch = watch(session);
      emit('sourcechange', session);
      // A fatal error raised while the handler was still loading arrived
      // before that subscription. The engine keeps the last one and clears
      // it on every `load`, so this reports that error and never an older one.
      const pending =
        session.engine === null ? null : fromEngineError(session.engine.error, session.handler);
      if (pending !== null) emit('error', pending);
      return session;
    }

    if (mine === generation) emit('error', unclaimed(resolved));
    throw new Error(`no handler for ${resolved.url}`);
  }

  function load(source: Source): Promise<Session> {
    const mine = ++generation;
    const started = queue.then(
      () => run(source, mine),
      () => run(source, mine),
    );
    queue = started.catch(() => undefined);
    return started;
  }

  function unload(): Promise<void> {
    generation += 1;
    const started = queue.then(release, release).then(() => {
      emit('sourcechange', null);
    });
    queue = started.catch(() => undefined);
    return started;
  }

  return {
    load,
    unload,
    get session(): Session | null {
      return current;
    },
    on<E extends PlayerEvent>(event: E, fn: (payload: PlayerEvents[E]) => void): () => void {
      const set = listeners[event] as Set<(payload: PlayerEvents[E]) => void>;
      set.add(fn);
      return () => {
        set.delete(fn);
      };
    },
  };
}
