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
import { Blocked, Declined, fromEngineError, fromMediaError } from './errors.js';
import { inferType } from './infer-type.js';
import type { Resolved } from './programme.js';
import { ConnectorFailure, connectorFor, expand, partsOf, run } from './programme.js';
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
  Programme,
  ProgrammeSource,
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

/** How long a preload counts by default, in seconds: as long as the engine keeps a preloaded manifest. */
const KEEP_SECONDS = 30;

/** A connector source `preload` resolved, or is resolving. */
interface Kept {
  readonly type: string;
  readonly id: string | undefined;
  readonly data: unknown;
  readonly until: number;
  readonly result: Promise<Resolved>;
  readonly control: AbortController;
}

export function createPlayer(video: HTMLMediaElement, options: PlayerOptions): Player {
  const listeners: { readonly [E in PlayerEvent]: Set<(payload: PlayerEvents[E]) => void> } = {
    programme: new Set(),
    sourcechange: new Set(),
    error: new Set(),
  };
  const connectors = options.connectors ?? [];
  let current: Session | null = null;
  let programme: Programme | null = null;
  /** Aborts the connector fetch of the load in flight, when a newer load or an unload comes. */
  let controller: AbortController | null = null;
  /**
   * What the last `preload` of a connector source resolved, which the next
   * load of the same programme takes instead of asking the connector again.
   * One at a time, and for as long as the engine keeps a preloaded
   * manifest: a resolution can carry a token that expires.
   */
  let kept: Kept | null = null;
  /** The programme the last preload resolved, for a page that shows what comes next. */
  let preloaded: Programme | null = null;
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

  function load(source: ProgrammeSource | readonly ProgrammeSource[]): Promise<Session> {
    const mine = ++generation;
    controller?.abort();
    const control = new AbortController();
    controller = control;
    const start = async (): Promise<Session> => {
      await release();
      const given = Array.isArray(source)
        ? (source as readonly ProgrammeSource[])
        : [source as ProgrammeSource];
      let resolved: Programme;
      try {
        resolved = await expand(given, connectors, control.signal, take);
      } catch (cause) {
        if (mine === generation && cause instanceof ConnectorFailure) {
          // A failed programme is still one: a tracker started on it sees the error that follows.
          const context = cause.error.context as { type: string; id?: string };
          programme = {
            given,
            sources: [],
            type: context.type,
            ...(context.id === undefined ? {} : { id: context.id }),
          };
          emit('programme', programme);
          emit('error', cause.error);
        }
        throw cause;
      }
      // A later load replaced this one: its chain still runs, as before connectors, and disposes what it gets.
      if (mine === generation) {
        programme = resolved;
        emit('programme', resolved);
        if (resolved.block !== undefined) throw new Blocked(resolved.block);
      }
      candidates = resolved.sources;
      index = 0;
      armed = true;
      return select(mine);
    };
    const started = queue.then(start, start);
    queue = started.catch(() => undefined);
    return started;
  }

  /**
   * The kept resolution of this connector source, once: a second load asks
   * the connector again. Undefined when the preload was of another
   * programme or is too old. The load's abort reaches the preload's requests.
   */
  function take(
    type: string,
    id: string | undefined,
    data: unknown,
    signal: AbortSignal,
  ): Promise<Resolved> | undefined {
    const entry = kept;
    if (entry === null || entry.type !== type) return undefined;
    const same = data !== undefined ? entry.data === data : id !== undefined && entry.id === id;
    if (!same) return undefined;
    kept = null;
    if (Date.now() > entry.until) {
      entry.control.abort();
      return undefined;
    }
    signal.addEventListener('abort', () => entry.control.abort());
    return entry.result;
  }

  /** Preloads the first source of the list a handler takes, with the handler that would play it. */
  async function preloadSources(
    list: readonly Source[],
    preloadOptions: PreloadOptions | undefined,
  ): Promise<void> {
    const env = environment();
    for (const given of list) {
      const resolved = resolve(given);
      const handler = ordered(resolved, env).find((h) => h.canHandle(resolved, env) !== '');
      if (handler === undefined) continue;
      // The handler that would play it, or nothing: another one's bytes would go unread.
      await handler.preload?.(resolved, preloadOptions)?.catch(() => undefined);
      return;
    }
  }

  async function preload(
    source: ProgrammeSource | readonly ProgrammeSource[],
    preloadOptions?: PreloadOptions,
  ): Promise<void> {
    const list = Array.isArray(source)
      ? (source as readonly ProgrammeSource[])
      : [source as ProgrammeSource];
    const at = list.findIndex(
      (given) => !('url' in given) || connectorFor(given, connectors) !== undefined,
    );
    // Plain sources before the first connector source preload as they are.
    if (at !== 0)
      return preloadSources(list.slice(0, at === -1 ? undefined : at) as Source[], preloadOptions);
    const given = list[0] as ProgrammeSource;
    const connector = connectorFor(given, connectors);
    if (connector === undefined) return;
    const { id, data } = partsOf(given);
    // A newer preload replaces the one kept: its requests stop.
    kept?.control.abort();
    const control = new AbortController();
    const result = run(connector, id, data, control.signal);
    const entry: Kept = {
      type: connector.type,
      id,
      data,
      until: Date.now() + (preloadOptions?.keepSeconds ?? KEEP_SECONDS) * 1000,
      result,
      control,
    };
    kept = entry;
    let resolved: Resolved;
    try {
      resolved = await result;
    } catch {
      // The load asks the connector again, and reports what it says then.
      if (kept === entry) kept = null;
      return;
    }
    const { resolution } = resolved;
    preloaded = {
      given: list,
      sources: resolution.sources,
      type: connector.type,
      ...(id === undefined ? {} : { id }),
      data: resolved.data,
      ...(resolution.metadata === undefined ? {} : { metadata: resolution.metadata }),
      ...(resolution.block === undefined ? {} : { block: resolution.block }),
    };
    // A blocked programme loads nothing, so nothing of it is fetched ahead.
    if (resolution.block !== undefined || kept !== entry) return;
    await preloadSources(resolution.sources, preloadOptions);
  }

  function unload(): Promise<void> {
    generation += 1;
    controller?.abort();
    const started = queue.then(release, release).then(() => {
      emit('sourcechange', null);
      if (programme === null) return;
      programme = null;
      emit('programme', null);
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
    get programme(): Programme | null {
      return programme;
    },
    get preloaded(): Programme | null {
      return preloaded;
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
