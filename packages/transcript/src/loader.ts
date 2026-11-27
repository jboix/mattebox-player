/**
 * Which parts of a transcript are loaded. No DOM, no timers.
 *
 * The lines load as the viewer needs them: the part around the playhead
 * when the panel opens, the next part when the list is scrolled to its
 * edge, the part around a match the viewer jumps to, and everything when
 * the panel's own search needs every line. Each part is asked of the
 * engine once.
 */
import type { Cue, Span } from './lines.js';

/** Reads the cues of the segments that overlap a range. The engine's `transcript.cues`. */
export type Read = (range: Span & { readonly signal: AbortSignal }) => Promise<readonly Cue[]>;

/** Seconds loaded on each side of a moment, and in one step of a scroll. */
export const WINDOW = 90;

export interface Loader {
  /** The cues loaded so far, in the order they arrived. */
  readonly cues: readonly Cue[];
  /** The parts loaded, by start, merged where they touch. */
  readonly loaded: readonly Span[];
  /** Requests under way, and one more while everything is being loaded. */
  readonly pending: number;
  /** Whether the last request failed. Cleared by the next one that succeeds. */
  readonly failed: boolean;
  /** Loads what is missing of `WINDOW` seconds on each side of `time`. */
  around(time: number): Promise<void>;
  /** Loads the part of `gap` next to `side`, one step of it. */
  into(gap: Span, side: 'start' | 'end'): Promise<void>;
  /** Loads everything that is missing, the parts nearest `time` first. */
  all(time: number): Promise<void>;
  /** Stops the requests under way. The loader takes no more. */
  stop(): void;
}

/** `spans` by start, with those that touch or overlap made one. */
export function merge(spans: readonly Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const out: Span[] = [];
  for (const span of sorted) {
    const last = out[out.length - 1];
    if (last !== undefined && span.start <= last.end) {
      out[out.length - 1] = { start: last.start, end: Math.max(last.end, span.end) };
    } else out.push(span);
  }
  return out;
}

/** The parts of `span` that `loaded` does not cover. `loaded` is sorted and merged. */
export function missing(span: Span, loaded: readonly Span[]): Span[] {
  const out: Span[] = [];
  let from = span.start;
  for (const part of loaded) {
    if (part.end <= from) continue;
    if (part.start >= span.end) break;
    if (part.start > from) out.push({ start: from, end: part.start });
    from = Math.max(from, part.end);
  }
  if (from < span.end) out.push({ start: from, end: span.end });
  return out;
}

/**
 * A loader over `read`, for a programme `length` seconds long. `changed`
 * runs after each part arrives or fails.
 */
export function createLoader(read: Read, length: number, changed: () => void): Loader {
  const control = new AbortController();
  const cues: Cue[] = [];
  let loaded: Span[] = [];
  // Parts asked for and not yet here, so two callers do not ask twice.
  let asked: Span[] = [];
  let pending = 0;
  // Whether everything is being loaded: between two of its steps no request is under way.
  let filling = 0;
  let failed = false;
  let stopped = false;

  const clamp = (span: Span): Span => ({
    start: Math.max(0, span.start),
    end: Math.min(length, span.end),
  });

  async function load(span: Span): Promise<void> {
    const wanted = clamp(span);
    const parts = missing(wanted, merge([...loaded, ...asked]));
    await Promise.all(
      parts.map(async (part) => {
        if (stopped || part.end <= part.start) return;
        asked = merge([...asked, part]);
        pending += 1;
        try {
          const more = await read({ ...part, signal: control.signal });
          if (stopped) return;
          cues.push(...more);
          loaded = merge([...loaded, part]);
          failed = false;
        } catch {
          if (stopped) return;
          failed = true;
        } finally {
          pending -= 1;
          // A part that failed is asked again by the next caller.
          asked = asked.flatMap((span) => missing(span, [part]));
          if (!stopped) changed();
        }
      }),
    );
  }

  return {
    get cues() {
      return cues;
    },
    get loaded() {
      return loaded;
    },
    get pending() {
      return pending + filling;
    },
    get failed() {
      return failed;
    },
    around(time) {
      return load({ start: time - WINDOW, end: time + WINDOW });
    },
    into(gap, side) {
      return load(
        side === 'start'
          ? { start: gap.start, end: Math.min(gap.end, gap.start + WINDOW) }
          : { start: Math.max(gap.start, gap.end - WINDOW), end: gap.end },
      );
    },
    async all(time) {
      // In steps, so the lines near the viewer are there first and a long
      // programme does not wait on its last segment to show its first.
      const steps: Span[] = [];
      for (let start = 0; start < length; start += WINDOW * 2) {
        steps.push({ start, end: Math.min(length, start + WINDOW * 2) });
      }
      const middle = (span: Span): number => (span.start + span.end) / 2;
      steps.sort((a, b) => Math.abs(middle(a) - time) - Math.abs(middle(b) - time));
      filling += 1;
      // A new try: a failure from before does not end it.
      failed = false;
      try {
        for (const step of steps) {
          if (stopped) break;
          await load(step);
          // A step that failed ends it: the next search asks again.
          if (failed) break;
        }
      } finally {
        filling -= 1;
        if (!stopped) changed();
      }
    },
    stop() {
      stopped = true;
      control.abort();
    },
  };
}
