/**
 * The optional namespaces, and the one place the player reaches for them.
 *
 * `'live' in engine` is the documented feature test, but it does not narrow,
 * because the properties are not on the type. A namespace reaches the type
 * only through a `declare module` merge in the stage that contributes it,
 * and only when that stage's types are loaded. So the casts live here,
 * once, and the controls read a plain optional shape.
 */
import type { Mattebox } from 'mattebox';
import type { LiveApi } from 'mattebox/protocols/hls-live';
import type { ChaptersApi } from 'mattebox/stages/chapters';
import type { DrmApi } from 'mattebox/stages/eme-core';
import type { PdtApi } from 'mattebox/stages/pdt';
import type { ThumbnailsApi } from 'mattebox/stages/thumbnails';
import type { TrickApi } from 'mattebox/stages/trick-play';

export type { LiveApi, PdtApi };

/**
 * `setCertificateUrl` arrived in mattebox 0.12. Optional here, so the
 * element runs on an older engine and gives the certificate where it can.
 */
type Drm = DrmApi & { readonly setCertificateUrl?: (url: string) => void };

export interface Namespaces {
  readonly live?: LiveApi;
  readonly drm?: Drm;
  readonly thumbnails?: ThumbnailsApi;
  readonly pdt?: PdtApi;
  readonly chapters?: ChaptersApi;
  readonly trick?: TrickApi;
}

/** The optional namespaces on an engine, each present exactly when its stage was composed. */
export function namespaces(engine: Mattebox): Namespaces {
  return engine as Namespaces;
}
