/**
 * The optional namespaces, and the one place the player reaches for them.
 *
 * `'live' in engine` is the documented feature test, but it does not narrow,
 * because the properties are not on the type. A namespace reaches the type
 * only through a `declare module` merge in the stage that contributes it,
 * and of the three a player shows, one merge is unreachable and one does not
 * exist. See docs/integrator-log.md. So the casts live here, once, and the
 * panels read a plain optional shape.
 */
import type { Mattebox } from 'mattebox';
import type { DrmApi } from 'mattebox/stages/eme-core';
import type { ThumbnailsApi } from 'mattebox/stages/thumbnails';

/**
 * Declared here because it cannot be imported: `LiveApi` lives in
 * `dist/protocols/live-shared.d.ts`, which neither the package's `exports`
 * nor its `typesVersions` reaches. This is a copy, and it will drift.
 */
export interface LiveApi {
  /** Where seekToEdge lands, in presentation time, or null before the first window. */
  readonly edge: number | null;
  /** Seconds between the availability end and the playhead, or null. */
  readonly latency: number | null;
  readonly atEdge: boolean;
  seekToEdge(): void;
}

export interface Namespaces {
  readonly live?: LiveApi;
  readonly drm?: DrmApi;
  readonly thumbnails?: ThumbnailsApi;
}

/** The optional namespaces on an engine, each present exactly when its stage was composed. */
export function namespaces(engine: Mattebox): Namespaces {
  return engine as Namespaces;
}
