/**
 * One shape for two sources of failure: the engine's error payloads and the
 * element's `MediaError`. The mapping from `MediaError` is the engine's own,
 * copied so a native session reports the same code an engine session would
 * report for the same failure. See the engine's guide chapter 09.
 */
import type { MatteboxError } from 'mattebox';
import type { PlayerError } from './types.js';

/**
 * Thrown from `handle` when a handler cannot claim the source after all. The
 * chain treats it as an empty `canHandle` and tries the next handler. The
 * mattebox handler throws it on `MANIFEST_UNSUPPORTED`.
 */
export class Declined extends Error {}

/** The names behind `MediaError.code`, for the error's context. */
const MEDIA_ERR = [
  '',
  'MEDIA_ERR_ABORTED',
  'MEDIA_ERR_NETWORK',
  'MEDIA_ERR_DECODE',
  'MEDIA_ERR_SRC_NOT_SUPPORTED',
];

/**
 * The element's `MediaError` in the core's shape, or null when there is
 * nothing to report. An abort is the app's doing, so it is not an error.
 */
export function fromMediaError(video: HTMLMediaElement, handler: string): PlayerError | null {
  const code = video.error?.code ?? 0;
  if (code === 0 || code === 1) return null;
  return {
    category: 'media',
    code: code === 4 ? 'MEDIA_CODEC_UNSUPPORTED' : 'MEDIA_DECODE_ERROR',
    fatal: true,
    recoverable: false,
    handler,
    context: { mediaError: MEDIA_ERR[code] ?? code, message: video.error?.message ?? '' },
  };
}

/** The engine's `error` payload in the core's shape, or null when it is not one. */
export function fromEngineError(payload: unknown, handler: string): PlayerError | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const error = payload as MatteboxError;
  if (typeof error.code !== 'string' || typeof error.category !== 'string') return null;
  return {
    category: error.category,
    code: error.code,
    fatal: error.fatal === true,
    recoverable: error.recoverable === true,
    handler,
    ...(error.context === undefined ? {} : { context: error.context }),
  };
}
