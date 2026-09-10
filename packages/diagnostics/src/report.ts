/**
 * The report: everything the panel shows, as one plain object a page can
 * send when something goes wrong, and the trace the engine's guide asks
 * for with every error report (chapter 12), as the element kept it: see
 * `trace.ts` for what is kept of each entry. Every field is serializable;
 * a native session has no engine part.
 */
import type { Mattebox } from 'mattebox';
import type { PlayerError, PlayerHost } from './host.js';
import type { Counters, Mark, Sample } from './sampler.js';
import type { Support } from './support.js';

export interface RangeReport {
  readonly start: number;
  readonly end: number;
}

export interface PlaybackReport {
  readonly currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  readonly ended: boolean;
  readonly seeking: boolean;
  readonly readyState: number;
  readonly networkState: number;
  readonly playbackRate: number;
  readonly volume: number;
  readonly muted: boolean;
  readonly videoWidth: number;
  readonly videoHeight: number;
  readonly buffered: readonly RangeReport[];
  readonly seekable: readonly RangeReport[];
  readonly frames: { readonly decoded: number; readonly dropped: number } | null;
  readonly mediaError: { readonly code: number; readonly message: string } | null;
}

export interface EngineReport {
  readonly phase: string;
  readonly capabilities: readonly string[];
  readonly throughput: { readonly slow: number; readonly fast: number };
  readonly bufferGoal: number;
  readonly buffers: ReadonlyArray<{
    readonly id: string;
    readonly codecs: string;
    readonly ranges: readonly RangeReport[];
  }>;
  readonly inflight: ReadonlyArray<{
    readonly trackId: string;
    readonly seq: number;
    readonly url: string;
  }>;
  readonly live: {
    readonly start: number;
    readonly end: number;
    readonly edge: number;
    readonly latency: number | null;
  } | null;
  readonly tracks: {
    readonly active: Readonly<Record<string, string | null>>;
    readonly available: ReadonlyArray<{
      readonly id: string;
      readonly contentType: string;
      readonly mimeType: string;
      readonly lang: string | null;
      readonly role: string | null;
      readonly renditions: number;
    }>;
  };
  readonly quality: {
    readonly playing: string | null;
    readonly active: string | null;
    readonly pinned: string | null;
    readonly allowed: readonly string[];
    readonly renditions: ReadonlyArray<{
      readonly id: string;
      readonly bitrate: number;
      readonly width: number | null;
      readonly height: number | null;
      readonly frameRate: number | null;
      readonly codecs: string | null;
    }>;
  };
  readonly drm: {
    readonly keySystem: string | null;
    readonly sessions: ReadonlyArray<{ readonly keyId: string; readonly status: string }>;
  } | null;
  readonly error: {
    readonly category: string;
    readonly code: string;
    readonly fatal: boolean;
    readonly recoverable: boolean;
    readonly context: Readonly<Record<string, unknown>> | null;
  } | null;
}

export interface DiagnosticsReport {
  /** When the report was taken, ISO 8601. */
  readonly at: string;
  readonly userAgent: string;
  readonly source: {
    readonly url: string | null;
    readonly type: string | null;
    /** The name of the handler that won, or null before a session. */
    readonly handler: string | null;
  };
  readonly playback: PlaybackReport;
  /** The player's fatal error of the current load, or null. */
  readonly error: PlayerError | null;
  /** Null for a native session. */
  readonly engine: EngineReport | null;
  readonly counters: Counters;
  /** The last two minutes of samples, and the marks in them. */
  readonly samples: readonly Sample[];
  readonly marks: readonly Mark[];
  /** What the browser supports, when it was probed before the report. */
  readonly support: Support | null;
  /** The trace entries the element kept, slimmed, oldest first, or null for a native session. */
  readonly trace: readonly unknown[] | null;
}

/** The optional namespaces the report reads, as the player reads them: a cast, once. */
interface Namespaces {
  readonly live?: { readonly latency: number | null };
  readonly drm?: {
    readonly keySystem: string | null;
    readonly sessions: ReadonlyArray<{ readonly keyId: string; readonly status: string }>;
  };
}

function ranges(list: TimeRanges): RangeReport[] {
  return Array.from({ length: list.length }, (_, i) => ({
    start: list.start(i),
    end: list.end(i),
  }));
}

export function playbackFacts(video: HTMLVideoElement): PlaybackReport {
  const quality = video.getVideoPlaybackQuality?.();
  return {
    currentTime: video.currentTime,
    duration: video.duration,
    paused: video.paused,
    ended: video.ended,
    seeking: video.seeking,
    readyState: video.readyState,
    networkState: video.networkState,
    playbackRate: video.playbackRate,
    volume: video.volume,
    muted: video.muted,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    buffered: ranges(video.buffered),
    seekable: ranges(video.seekable),
    frames:
      quality === undefined
        ? null
        : { decoded: quality.totalVideoFrames, dropped: quality.droppedVideoFrames },
    mediaError:
      video.error === null ? null : { code: video.error.code, message: video.error.message },
  };
}

export function engineFacts(engine: Mattebox): EngineReport {
  const state = engine.stats.snapshot();
  const optional = engine as Namespaces;
  const error = engine.error;
  return {
    phase: state.lifecycle.phase,
    capabilities: [...engine.capabilities()],
    throughput: { slow: state.stats.throughputEwma, fast: state.stats.throughputFastEwma },
    bufferGoal: state.scheduling.bufferGoal,
    buffers: [...state.buffers.entries()].map(([id, buffer]) => ({
      id,
      codecs: buffer.codecs,
      ranges: buffer.ranges.map((range) => ({ start: range.start, end: range.end })),
    })),
    inflight: [...state.scheduling.inflight.values()].map((request) => ({
      trackId: request.trackId,
      seq: request.seq,
      url: request.url,
    })),
    live:
      state.live === null
        ? null
        : {
            start: state.live.span.start,
            end: state.live.span.end,
            edge: state.live.edge,
            latency: optional.live?.latency ?? null,
          },
    tracks: {
      active: Object.fromEntries(
        (['video', 'audio', 'text'] as const).map((type) => [
          type,
          engine.tracks.active(type)?.id ?? null,
        ]),
      ),
      available: engine.tracks.available.map((track) => ({
        id: track.id,
        contentType: track.contentType,
        mimeType: track.mimeType,
        lang: track.lang ?? null,
        role: track.role ?? null,
        renditions: track.renditions.length,
      })),
    },
    quality: {
      playing: engine.quality.playing?.id ?? null,
      active: engine.quality.active?.id ?? null,
      pinned: engine.quality.pinned,
      allowed: engine.quality.allowed.map((r) => r.id),
      renditions: engine.quality.renditions.map((r) => ({
        id: r.id,
        bitrate: r.bitrate,
        width: r.width ?? null,
        height: r.height ?? null,
        frameRate: r.frameRate ?? null,
        codecs: r.codecs,
      })),
    },
    drm:
      optional.drm === undefined
        ? null
        : { keySystem: optional.drm.keySystem, sessions: [...optional.drm.sessions] },
    error:
      error === null
        ? null
        : {
            category: error.category,
            code: error.code,
            fatal: error.fatal,
            recoverable: error.recoverable,
            context: error.context ?? null,
          },
  };
}

/** Two minutes of samples at two a second, and the marks of the same two minutes. */
const KEEP_SAMPLES = 240;
const KEEP_MS = 120_000;

export interface ReportSources {
  readonly player: PlayerHost;
  readonly samples: readonly Sample[];
  readonly marks: readonly Mark[];
  readonly counters: Counters;
  /** The trace entries kept, slimmed, oldest first. */
  readonly history: readonly unknown[];
  readonly support: Support | null;
}

export function buildReport(sources: ReportSources): DiagnosticsReport {
  const { player } = sources;
  const engine = player.engine;
  const samples = sources.samples.slice(-KEEP_SAMPLES);
  const since = performance.now() - KEEP_MS;
  return {
    at: new Date().toISOString(),
    userAgent: navigator.userAgent,
    source: {
      url: player.getAttribute('src'),
      type: player.getAttribute('type'),
      handler: player.player?.session?.handler ?? null,
    },
    playback: playbackFacts(player.video),
    error: player.error,
    engine: engine === null ? null : engineFacts(engine),
    counters: sources.counters,
    samples,
    marks: sources.marks.filter((mark) => mark.t >= since),
    support: sources.support,
    trace: engine === null ? null : sources.history,
  };
}
