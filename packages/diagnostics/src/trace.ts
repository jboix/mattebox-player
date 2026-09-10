/**
 * A trace entry as the element keeps it: slimmed the way the engine's
 * playground slims one before it goes anywhere, and made plain. A manifest
 * is a summary of its tracks and renditions with segment counts, a
 * playlist refresh a count, the bytes of a segment their length, a
 * scheduled message the same again, and a `tracks:changed` emit its name.
 * A raw entry references the whole presentation, so five hundred of them
 * serialize to megabytes on HLS; slimmed, a history is a few hundred
 * kilobytes at most, and holds nothing the engine does not hold anyway.
 */
import type { Effect, Message, Presentation, TraceEntry } from 'mattebox';

/** Segments as a count, whatever their addressing. */
function segmentCount(segments: unknown): number | string {
  if (Array.isArray(segments)) return segments.length;
  if (typeof segments === 'object' && segments !== null && 'kind' in segments) {
    return String((segments as { kind: unknown }).kind);
  }
  return 0;
}

/** A presentation as its shape: the periods, the tracks, the renditions, and how many segments each has. */
function slimPresentation(presentation: Presentation): unknown {
  return {
    id: presentation.id,
    isLive: presentation.isLive,
    duration: presentation.duration ?? null,
    live: presentation.live ?? null,
    periods: presentation.periods.map((period) => ({
      id: period.id,
      start: period.start,
      duration: period.duration ?? null,
      tracks: period.tracks.map((track) => ({
        id: track.id,
        contentType: track.contentType,
        mimeType: track.mimeType,
        lang: track.lang ?? null,
        role: track.role ?? null,
        protected: track.protection !== null && track.protection.schemes.length > 0,
        renditions: track.renditions.map((r) => ({
          id: r.id,
          bitrate: r.bitrate,
          width: r.width ?? null,
          height: r.height ?? null,
          codecs: r.codecs,
          segments: segmentCount(r.segments),
        })),
      })),
    })),
  };
}

function slimMessage(msg: Message): unknown {
  switch (msg.type) {
    case 'MANIFEST_LOADED':
      return { type: msg.type, presentation: slimPresentation(msg.presentation) };
    case 'PLAYLIST_REFRESHED':
      return { ...msg, segments: segmentCount(msg.segments) };
    case 'SEGMENT_LOADED':
      return { ...msg, bytes: length(msg.bytes) };
    default:
      return msg;
  }
}

/** A payload's length, whether it is still bytes or already the engine's `{ $bytes }` marker. */
function length(value: unknown): unknown {
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return value.byteLength;
  return value;
}

function slimEffect(effect: Effect): unknown {
  if (effect.kind === 'emit' && effect.event === 'tracks:changed') {
    return { kind: effect.kind, event: effect.event };
  }
  // A scheduled message is a whole message, a manifest refresh among them.
  // biome-ignore lint/suspicious/noThenProperty: `then` is the schedule effect's field name in the engine's message taxonomy
  if (effect.kind === 'schedule') return { ...effect, then: slimMessage(effect.then) };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(effect as unknown as Record<string, unknown>)) {
    out[key] = length(value);
  }
  return out;
}

/**
 * JSON with the values a trace carries that JSON does not: byte buffers as
 * their length, maps as objects, sets as arrays, functions and DOM nodes
 * as their names.
 */
function serializable(_key: string, value: unknown): unknown {
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return value.byteLength;
  if (value instanceof Map) return Object.fromEntries(value);
  if (value instanceof Set) return [...value];
  if (typeof value === 'function') return '[function]';
  if (typeof Node !== 'undefined' && value instanceof Node) return `[${value.nodeName}]`;
  return value;
}

/** One entry, slimmed and plain. */
export function slimEntry(entry: TraceEntry): unknown {
  const slim = {
    t: entry.t,
    msg: slimMessage(entry.msg),
    effects: entry.effects.map(slimEffect),
    digest: entry.digest,
  };
  return JSON.parse(JSON.stringify(slim, serializable)) as unknown;
}
