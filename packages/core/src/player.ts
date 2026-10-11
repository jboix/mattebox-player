/**
 * The chain runner. One player per element, like an engine: no globals, no
 * registry. Handlers run in order and the first non-empty `canHandle` wins,
 * with the three-tier answer of `canPlayType`. A `probably` from a later
 * handler does not beat a `maybe` from an earlier one, because the order is
 * the integrator's policy, not a ranking.
 *
 * A list of sources runs the chain once per source, in the list's order,
 * as a video does with its `<source>` children. The window in which a
 * failed source gives way to the next one ends at the first `playing`
 * event, later than a video's own: a DRM failure arrives after the
 * metadata and before the first frame.
 */
import { Declined, fromEngineError, fromMediaError } from './errors.js';
import { inferType } from './infer-type.js';
import type {
  Handler,
  HandlerEnvironment,
  HandlerSession,
  Player,
  PlayerError,
  PlayerEvent,
  PlayerEvents,
  PlayerOptions,
  PreloadOptions,
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
  /** The sources of the current load, and the one being tried. */
  let candidates: readonly Source[] = [];
  let index = 0;
  /** True from a load until the video's first `playing`: a fatal error then tries the next source. */
  let armed = false;

  function emit<E extends PlayerEvent>(event: E, payload: PlayerEvents[E]): void {
    const set = listeners[event] as Set<(payload: PlayerEvents[E]) => void>;
    for (const fn of [...set]) fn(payload);
  }

  /** The error of a source: fatal for the last one, and otherwise named after its source. */
  function reject(error: PlayerError, source: Source): void {
    emit('error', index < candidates.length - 1 ? { ...error, fatal: false, source } : error);
  }

  /**
   * An error of the current session. A fatal one before the first frame
   * ends that source when the list has another, which then loads in the
   * queue, behind whatever the page asked for in the meantime.
   */
  function fail(error: PlayerError | null, session: Session, mine: number): void {
    if (error === null) return;
    if (!error.fatal || !armed || mine !== generation || index >= candidates.length - 1) {
      emit('error', error);
      return;
    }
    // The session is over, and a second fatal error from it must not skip a source.
    unwatch?.();
    unwatch = null;
    reject(error, session.source);
    // Releasing the session pauses the video, so a play the viewer asked for is asked again.
    const resume = video.paused === false;
    const next = async (): Promise<void> => {
      if (mine !== generation) return;
      await release();
      index += 1;
      await select(mine);
      if (resume && mine === generation) video.play().catch(() => undefined);
    };
    queue = queue.then(next, next).catch(() => undefined);
  }

  /**
   * One error subscription per session. An engine reports the element's
   * `MediaError` itself, so a session with an engine is never watched twice.
   */
  function watch(session: Session, mine: number): () => void {
    const onPlaying = (): void => {
      armed = false;
    };
    video.addEventListener('playing', onPlaying);
    const offs = [(): void => video.removeEventListener('playing', onPlaying)];
    if (session.engine !== null) {
      offs.push(
        session.engine.on('error', (payload) => {
          fail(fromEngineError(payload, session.handler), session, mine);
        }),
      );
    } else {
      const onError = (): void => {
        fail(fromMediaError(video, session.handler), session, mine);
      };
      video.addEventListener('error', onError);
      offs.push(() => video.removeEventListener('error', onError));
      // A native session with DRM attached reports its license failures too:
      // the element's own error never says why a key did not arrive.
      const offEme = session.eme?.on('error', (payload) => {
        fail(fromEngineError(payload, session.handler), session, mine);
      });
      if (offEme !== undefined) offs.push(offEme);
    }
    return () => {
      for (const off of offs) off();
    };
  }

  async function release(): Promise<void> {
    const session = current;
    current = null;
    unwatch?.();
    unwatch = null;
    if (session !== null) await session.dispose();
  }

  function environment(): HandlerEnvironment {
    return { video, mse: 'MediaSource' in globalThis || 'ManagedMediaSource' in globalThis };
  }

  /** The source with its type, from the page or from the extension. */
  function resolve(given: Source): Source {
    const type = given.type ?? inferType(given.url);
    return type === undefined ? given : { ...given, type };
  }

  /** The handlers in the order `load` asks them. Each is asked only when its turn comes. */
  function ordered(resolved: Source, env: HandlerEnvironment): Handler[] {
    // A handler that prefers the source goes first. The rest keep the page's order.
    const first = options.handlers.filter((handler) => handler.prefers?.(resolved, env) === true);
    const rest = options.handlers.filter((handler) => !first.includes(handler));
    return [...first, ...rest];
  }

  /** Runs the chain for each source from `index`, until a handler takes one. */
  async function select(mine: number): Promise<Session> {
    const env = environment();
    let url = '';
    for (; index < candidates.length; index += 1) {
      const resolved = resolve(candidates[index] as Source);
      url = resolved.url;

      for (const handler of ordered(resolved, env)) {
        if (handler.canHandle(resolved, env) === '') continue;
        let handled: HandlerSession;
        try {
          handled = await handler.handle(resolved, video);
        } catch (cause) {
          // The handler claimed the source and then found it was not its own.
          if (cause instanceof Declined) continue;
          throw cause;
        }
        // The runner adds the source, so a page's own handler gets it too.
        const session: Session = { ...handled, source: resolved };
        if (mine !== generation) {
          // A later load was called while this one ran. It wins, so this
          // session is disposed and never becomes `player.session`.
          await session.dispose();
          return session;
        }
        current = session;
        unwatch = watch(session, mine);
        emit('sourcechange', session);
        // A fatal error raised while the handler was still loading arrived
        // before that subscription. The engine keeps the last one and clears
        // it on every `load`, so this reports that error and never an older one.
        fail(
          session.engine === null ? null : fromEngineError(session.engine.error, session.handler),
          session,
          mine,
        );
        return session;
      }

      if (mine !== generation) break;
      reject(unclaimed(resolved), resolved);
    }
    throw new Error(`no handler for ${url}`);
  }

  function load(source: Source | readonly Source[]): Promise<Session> {
    const mine = ++generation;
    const start = async (): Promise<Session> => {
      await release();
      candidates = Array.isArray(source) ? (source as readonly Source[]) : [source as Source];
      index = 0;
      armed = true;
      return select(mine);
    };
    const started = queue.then(start, start);
    queue = started.catch(() => undefined);
    return started;
  }

  async function preload(
    source: Source | readonly Source[],
    preloadOptions?: PreloadOptions,
  ): Promise<void> {
    const env = environment();
    for (const given of Array.isArray(source)
      ? (source as readonly Source[])
      : [source as Source]) {
      const resolved = resolve(given);
      const handler = ordered(resolved, env).find((h) => h.canHandle(resolved, env) !== '');
      if (handler === undefined) continue;
      // The handler that would play it, or nothing: another one's bytes would go unread.
      await handler.preload?.(resolved, preloadOptions)?.catch(() => undefined);
      return;
    }
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
    preload,
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
