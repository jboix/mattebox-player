/**
 * The seek bar's arithmetic, pure and node-tested: which span of time the
 * bar maps, and where a time or a range lands on it as a fraction.
 */

export interface Span {
  readonly start: number;
  readonly end: number;
}

export const EMPTY: Span = { start: 0, end: 0 };

/** A `TimeRanges` as spans. */
export function spans(ranges: TimeRanges): Span[] {
  const out: Span[] = [];
  for (let i = 0; i < ranges.length; i += 1)
    out.push({ start: ranges.start(i), end: ranges.end(i) });
  return out;
}

/**
 * The span the bar maps: the last seekable range for live, which is the
 * availability window the engine sets on the MediaSource; zero to the
 * duration for VOD; empty while neither is known.
 */
export function window(duration: number, seekable: readonly Span[], live: boolean): Span {
  if (live) {
    const last = seekable[seekable.length - 1];
    if (last !== undefined && last.end > last.start) return last;
  }
  return Number.isFinite(duration) && duration > 0 ? { start: 0, end: duration } : EMPTY;
}

/** Where a time sits on a span, clamped to it. Zero on an empty span. */
export function fraction(time: number, span: Span): number {
  const length = span.end - span.start;
  if (length <= 0) return 0;
  return Math.min(1, Math.max(0, (time - span.start) / length));
}

/** The time at a fraction of a span. */
export function at(part: number, span: Span): number {
  return span.start + Math.min(1, Math.max(0, part)) * (span.end - span.start);
}

/** Ranges clipped to a span, as fraction pairs, dropping what falls outside or collapses. */
export function clip(ranges: readonly Span[], span: Span): Array<readonly [number, number]> {
  const out: Array<readonly [number, number]> = [];
  for (const range of ranges) {
    const start = fraction(range.start, span);
    const end = fraction(range.end, span);
    if (end > start) out.push([start, end]);
  }
  return out;
}
