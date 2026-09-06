/**
 * The three concepts of the core: a source, the handlers that claim it, and
 * the session a handler returns. The player is the chain runner over them.
 */
import type { Mattebox } from 'mattebox';

/** A URL and, when known, its MIME type. Without a type the extension decides, see `inferType`. */
export interface Source {
  readonly url: string;
  readonly type?: string;
}

/** What a handler sees when asked whether it can play a source. */
export interface HandlerEnvironment {
  readonly video: HTMLMediaElement;
  /** `MediaSource` or `ManagedMediaSource` is present. */
  readonly mse: boolean;
}

/** The three-tier answer of `HTMLMediaElement.canPlayType`. An empty string declines. */
export type CanHandle = 'probably' | 'maybe' | '';

export interface Handler {
  readonly name: string;
  canHandle(source: Source, env: HandlerEnvironment): CanHandle;
  handle(source: Source, video: HTMLMediaElement): Promise<Session>;
}

/** What a handler holds on the element until disposed. */
export interface Session {
  /** The name of the handler that won. */
  readonly handler: string;
  /** The engine feeding the element, or null for native playback. The UI feature-tests its namespaces. */
  readonly engine: Mattebox | null;
  dispose(): Promise<void>;
}

/** One shape for the engine's errors and the element's `MediaError`. */
export interface PlayerError {
  readonly category: string;
  readonly code: string;
  readonly fatal: boolean;
  readonly recoverable: boolean;
  /** The handler whose session reported it. */
  readonly handler: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface PlayerEvents {
  /** A session replaced another, or was unloaded (null). */
  readonly sourcechange: Session | null;
  readonly error: PlayerError;
}

export type PlayerEvent = keyof PlayerEvents;

export interface PlayerOptions {
  /** Tried in order; the first non-empty `canHandle` wins. Order is the integrator's policy. */
  readonly handlers: readonly Handler[];
}

export interface Player {
  /** Disposes the current session, then runs the chain. Concurrent loads resolve in order; the last wins. */
  load(source: Source): Promise<Session>;
  unload(): Promise<void>;
  readonly session: Session | null;
  on<E extends PlayerEvent>(event: E, fn: (payload: PlayerEvents[E]) => void): () => void;
}
