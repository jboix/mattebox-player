/**
 * The sampler: what the charts, the counters and the report are drawn
 * from, taken every half second while the element is attached, so a stall
 * counted before the panel opened is still counted. It reads the way the
 * engine's playground reads: the kernel state through
 * `engine.stats.snapshot()`, the rendition playing through
 * `engine.quality.playing`, the trace for the segments, the stalls, the
 * seeks and what recovery did, and the video itself for the buffer ahead,
 * the frames and whether it is stalled. The engine emits no event for a
 * quality switch, so the switch is a poll's diff.
 *
 * The trace arrives as `trace` events where the engine emits them, one
 * entry at a time, and the sampler keeps its own history of them, slimmed
 * and bounded, which is what the report sends. An engine without the
 * event keeps a ring instead, and the sampler reads it through a cursor
 * that remembers the last entry seen by identity and, once the ring has
 * evicted it, by its clock. Both routes feed the same intake, and an
 * entry seen once is not taken twice.
 */
import type { Mattebox, Rendition, TraceEntry } from 'mattebox';
import { slimEntry } from './trace.js';

export interface Sample {
  /** performance.now() */
  readonly t: number;
  readonly currentTime: number;
  /** The slow and the fast throughput estimates, bits per second. */
  readonly slow: number;
  readonly fast: number;
  /** Seconds buffered ahead of the playhead. */
  readonly ahead: number;
  readonly stalled: boolean;
  /** Frames dropped and decoded since the last sample. */
  readonly dropped: number;
  readonly decoded: number;
  readonly playingId: string | null;
  readonly playingBitrate: number;
  readonly playingHeight: number;
}

export type MarkKind =
  | 'segment'
  | 'stall'
  | 'seek'
  | 'nudge'
  | 'flush'
  | 'skip'
  | 'gap-jump'
  | 'switch';

export interface Mark {
  readonly t: number;
  readonly kind: MarkKind;
  readonly value: number;
  readonly label: string;
  readonly trackId?: string;
}

export interface Counters {
  readonly stalls: number;
  /** Seconds spent stalled, the current stall included. */
  readonly stalledSeconds: number;
  readonly switches: number;
  /** The video's own totals for the session. */
  readonly decoded: number;
  readonly dropped: number;
}

export interface Sampler {
  /** Forgets everything and follows a session's trace: a new session starts its counts at zero. */
  attach(video: HTMLVideoElement, engine: Mattebox | null): void;
  /** Lets go of the session's trace. */
  release(): void;
  poll(video: HTMLVideoElement, engine: Mattebox | null): void;
  readonly samples: readonly Sample[];
  readonly marks: readonly Mark[];
  readonly counters: Counters;
  /** The trace entries kept, slimmed and plain, oldest first. */
  readonly history: readonly unknown[];
}

/** Twenty minutes at two samples a second. */
const MAX_SAMPLES = 2400;
/** Trace entries kept, the engine's own default for a ring. */
const MAX_HISTORY = 500;

const RECOVERY: ReadonlySet<string> = new Set(['nudge', 'flush', 'skip', 'gap-jump']);

/** A rendition's name for a mark: its height, else its bitrate. */
function label(r: Rendition): string {
  return r.height !== undefined ? `${r.height}p` : `${Math.round(r.bitrate / 1000)} kbps`;
}

export function createSampler(): Sampler {
  let samples: Sample[] = [];
  let marks: Mark[] = [];
  let history: unknown[] = [];
  /** Entries already taken, so the event and the ring never count one twice. */
  let seen = new WeakSet<TraceEntry>();
  let off: (() => void) | null = null;
  let last: TraceEntry | null = null;
  let lastT = 0;
  let lastQuality: { dropped: number; decoded: number } | null = null;
  let lastPlayingId: string | null = null;
  let stallStart: number | null = null;
  let stalls = 0;
  let stalledTotal = 0;
  let switches = 0;
  let decoded = 0;
  let dropped = 0;

  function push(mark: Mark): void {
    marks.push(mark);
    if (marks.length > MAX_SAMPLES * 2) marks.splice(0, marks.length - MAX_SAMPLES * 2);
  }

  /** The trace entries since the last read, oldest first. */
  function fresh(engine: Mattebox): readonly TraceEntry[] {
    const trace = engine.stats.trace();
    let from = 0;
    if (last !== null) {
      const at = trace.indexOf(last);
      from = at >= 0 ? at + 1 : trace.findIndex((entry) => entry.t > lastT);
      if (from < 0) from = trace.length;
    }
    const tail = trace[trace.length - 1];
    if (tail !== undefined) {
      last = tail;
      lastT = tail.t;
    }
    return trace.slice(from);
  }

  /** One entry in: its marks for the charts, and its slimmed self for the history. */
  function take(entry: TraceEntry, video: HTMLVideoElement): void {
    if (seen.has(entry)) return;
    seen.add(entry);
    history.push(slimEntry(entry));
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
    {
      const msg = entry.msg;
      if (msg.type === 'SEGMENT_LOADED' && msg.trackId !== 'manifest' && msg.size > 0) {
        push({
          t: entry.t,
          kind: 'segment',
          value: (msg.size * 8000) / Math.max(msg.rtt, 1),
          label: `${msg.trackId} #${msg.seq}`,
          trackId: msg.trackId,
        });
      } else if (msg.type === 'STALLED') {
        push({
          t: entry.t,
          kind: 'stall',
          value: msg.at,
          label: `stalled at ${msg.at.toFixed(1)}s`,
        });
      } else if (msg.type === 'SEEKING') {
        push({ t: entry.t, kind: 'seek', value: msg.to, label: `seek to ${msg.to.toFixed(1)}s` });
      }
      for (const effect of entry.effects) {
        if (effect.kind !== 'emit') continue;
        const name = effect.event.replace('recovery:', '');
        if (RECOVERY.has(name)) {
          push({
            t: entry.t,
            kind: name as MarkKind,
            value: video.currentTime,
            label: `recovery ${name}`,
          });
        }
      }
    }
  }

  function reset(): void {
    samples = [];
    marks = [];
    history = [];
    seen = new WeakSet();
    last = null;
    lastT = 0;
    lastQuality = null;
    lastPlayingId = null;
    stallStart = null;
    stalls = 0;
    stalledTotal = 0;
    switches = 0;
    decoded = 0;
    dropped = 0;
  }

  function release(): void {
    off?.();
    off = null;
  }

  return {
    attach(video, engine): void {
      release();
      reset();
      if (engine === null) return;
      off = engine.on('trace', (entry) => {
        take(entry as TraceEntry, video);
      });
    },

    release,

    poll(video, engine): void {
      const now = performance.now();
      // The ring, for an engine that keeps one and emits nothing.
      if (engine !== null) for (const entry of fresh(engine)) take(entry, video);
      const state = engine?.stats.snapshot() ?? null;
      const playing = engine?.quality.playing ?? null;

      const quality = video.getVideoPlaybackQuality?.();
      decoded = quality?.totalVideoFrames ?? 0;
      dropped = quality?.droppedVideoFrames ?? 0;
      const droppedDelta = lastQuality === null ? 0 : Math.max(0, dropped - lastQuality.dropped);
      const decodedDelta = lastQuality === null ? 0 : Math.max(0, decoded - lastQuality.decoded);
      lastQuality = { dropped, decoded };

      let ahead = 0;
      for (let i = 0; i < video.buffered.length; i += 1) {
        if (
          video.buffered.start(i) <= video.currentTime + 0.25 &&
          video.buffered.end(i) > video.currentTime
        ) {
          ahead = video.buffered.end(i) - video.currentTime;
        }
      }

      const stalled =
        !video.paused &&
        !video.ended &&
        !video.seeking &&
        video.readyState < 3 &&
        video.currentTime > 0;
      if (stalled && stallStart === null) {
        stallStart = now;
        stalls += 1;
      } else if (!stalled && stallStart !== null) {
        stalledTotal += (now - stallStart) / 1000;
        stallStart = null;
      }

      if (playing !== null && lastPlayingId !== null && playing.id !== lastPlayingId) {
        switches += 1;
        push({
          t: now,
          kind: 'switch',
          value: playing.height ?? playing.bitrate,
          label: `now ${label(playing)}`,
        });
      }
      if (playing !== null) lastPlayingId = playing.id;

      samples.push({
        t: now,
        currentTime: video.currentTime,
        slow: state?.stats.throughputEwma ?? 0,
        fast: state?.stats.throughputFastEwma ?? 0,
        ahead,
        stalled,
        dropped: droppedDelta,
        decoded: decodedDelta,
        playingId: playing?.id ?? null,
        playingBitrate: playing?.bitrate ?? 0,
        playingHeight: playing?.height ?? 0,
      });
      if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
    },

    get samples(): readonly Sample[] {
      return samples;
    },

    get marks(): readonly Mark[] {
      return marks;
    },

    get history(): readonly unknown[] {
      return history;
    },

    get counters(): Counters {
      const current = stallStart === null ? 0 : (performance.now() - stallStart) / 1000;
      return {
        stalls,
        stalledSeconds: stalledTotal + current,
        switches,
        decoded,
        dropped,
      };
    },
  };
}
