/**
 * The mattebox handler: the engine feeds the element through MediaSource.
 * `canHandle` is the engine's half of the routing decision, `accepts`, gated
 * on MSE support. The element's `canPlayType` is the other half and belongs
 * to the native handler; the engine deliberately does not combine them.
 */

import type { KernelConfig, Mattebox, MatteboxError, Stage, TransportConfig } from 'mattebox';
import { mattebox } from 'mattebox';
// `Preset` is only reachable through a preset subpath.
import type { Preset, PresetOptions } from 'mattebox/presets/full';
import { Declined } from '../errors.js';
import type { CanHandle, Handler, HandlerEnvironment, Session, Source } from '../types.js';

const NAME = 'mattebox';

export interface MatteboxHandlerOptions {
  /** A preset factory, such as the default export of `mattebox/presets/full`. */
  readonly preset?: Preset;
  /** Stages to compose. With a preset they merge by name; without one they are the whole stack. */
  readonly stages?: readonly Stage[];
  readonly config?: Partial<KernelConfig>;
  /** Network hooks and overrides. The tests inject `fetchImpl` through it. */
  readonly transport?: TransportConfig;
  /** Names of preset stages to leave out. Ignored without a preset. */
  readonly without?: readonly string[];
}

/** Drops the absent keys: `exactOptionalPropertyTypes` rejects an explicit undefined. */
function engineOptions(options: MatteboxHandlerOptions): PresetOptions {
  const built: {
    stages?: readonly Stage[];
    config?: Partial<KernelConfig>;
    transport?: TransportConfig;
    without?: readonly string[];
  } = {};
  if (options.stages !== undefined) built.stages = options.stages;
  if (options.config !== undefined) built.config = options.config;
  if (options.transport !== undefined) built.transport = options.transport;
  if (options.without !== undefined) built.without = options.without;
  return built;
}

/**
 * The handler over the engine. One engine per handler instance, created on
 * first use and reused across loads: `unload` and `detach` return the kernel
 * to its initial state, and a preset hands out fresh stage instances per
 * engine, so nothing carries over. It is created lazily because `accepts` is
 * an instance method, so the first routing question composes the whole stack.
 */
export function matteboxHandler(options: MatteboxHandlerOptions = {}): Handler {
  let engine: Mattebox | null = null;

  function ensure(): Mattebox {
    if (engine === null) {
      const built = engineOptions(options);
      engine = options.preset === undefined ? mattebox(built) : options.preset(built);
    }
    return engine;
  }

  function canHandle(source: Source, env: HandlerEnvironment): CanHandle {
    if (!env.mse) return '';
    // No type means the adapters sniff the bytes, which is a maybe, not a no.
    if (source.type === undefined) return 'maybe';
    return ensure().accepts(source.type) ? 'probably' : '';
  }

  async function handle(source: Source, video: HTMLMediaElement): Promise<Session> {
    const held = ensure();
    await held.attach(video);

    async function dispose(): Promise<void> {
      held.unload();
      await held.detach();
    }

    const session: Session = { handler: NAME, engine: held, dispose };

    return new Promise<Session>((resolve, reject) => {
      let settled = false;
      const offs: Array<() => void> = [];

      function finish(act: () => void): void {
        if (settled) return;
        settled = true;
        for (const off of offs) off();
        act();
      }

      // Subscribed before `load`: a mimeType no composed adapter declares
      // fails inside the call, before any request (engine guide 09).
      offs.push(
        held.on('error', (payload) => {
          const error = payload as MatteboxError;
          if (error?.fatal !== true) return;
          if (error.code !== 'MANIFEST_UNSUPPORTED') {
            // Any other fatal error is the session's error, not a
            // fallthrough. The core reports it on the unified event.
            finish(() => resolve(session));
            return;
          }
          finish(() => {
            void dispose().then(
              () => reject(new Declined(error.code)),
              () => reject(new Declined(error.code)),
            );
          });
        }),
      );

      // No engine event says "the manifest parsed". `tracks:changed` rides
      // the same reduction that moves the lifecycle phase to 'ready', so it
      // is the closest signal there is.
      offs.push(held.on('tracks:changed', () => finish(() => resolve(session))));

      held.load(source.url, source.type === undefined ? {} : { mimeType: source.type });

      // A manifest already parsed inside `load` leaves no event to catch.
      if (held.stats.snapshot().lifecycle.phase === 'ready') finish(() => resolve(session));
    });
  }

  return { name: NAME, canHandle, handle };
}
