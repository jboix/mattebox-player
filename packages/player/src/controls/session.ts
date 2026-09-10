/**
 * What the seek row reads of a session, in one place, so the time, the
 * seek bar and the live button agree: whether the stream is live, the span
 * the bar maps, and the wall clock at a presentation time. Every read is
 * feature-tested through `namespaces()`, and a native session answers as
 * VOD with no window and no clock.
 */
import type { Mattebox } from 'mattebox';
import type { LiveApi, Namespaces } from '../namespaces.js';
import { namespaces } from '../namespaces.js';
import type { Span } from './ranges.js';
import { spans, window } from './ranges.js';
import { clock } from './time.js';

/** The optional namespaces of an engine, or none for a native session. */
export function optional(engine: Mattebox | null): Namespaces {
  return engine === null ? {} : namespaces(engine);
}

/** The live namespace once the stream has an availability window, which is what makes it live. */
export function live(engine: Mattebox | null): LiveApi | undefined {
  const api = optional(engine).live;
  return api !== undefined && api.edge !== null ? api : undefined;
}

/**
 * The span the bar maps: the engine's own availability window for live,
 * where the session offers it, because the browser's seekable range on a
 * live MediaSource is the union of that window and whatever is buffered
 * and grows behind a paused playhead; the seekable range otherwise; zero
 * to the duration for VOD.
 */
export function span(video: HTMLVideoElement, engine: Mattebox | null): Span {
  const on = live(engine) !== undefined;
  const own = on ? (engine?.stats.snapshot().live?.span ?? null) : null;
  if (own !== null && own.end > own.start) return own;
  return window(video.duration, spans(video.seekable), on);
}

/** The engine's forward buffer goal in seconds, which lives on the diagnostics snapshot and nowhere else. */
export function bufferGoal(engine: Mattebox | null): number | null {
  return engine?.stats.snapshot().scheduling.bufferGoal ?? null;
}

/** The wall clock at a presentation time, when the session can say it. */
export function wall(engine: Mattebox | null, time: number): string | null {
  const epoch = optional(engine).pdt?.toWallClock(time) ?? null;
  return epoch === null ? null : clock(epoch);
}
