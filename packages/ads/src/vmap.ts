/**
 * VMAP 1.0.1, the IAB's Video Multiple Ad Playlist: when the breaks of a
 * programme go, and which VAST each one asks for. Only linear breaks are
 * read; a nonlinear or display break is left out.
 */
import { clock } from './vast.js';

/** Where a break goes: before, after, at a time, at a share of the duration, or at a chapter position. */
export type BreakOffset =
  | 'start'
  | 'end'
  | { readonly time: number }
  | { readonly percent: number }
  | { readonly position: number };

/** A break of the schedule, before its VAST is fetched. */
export interface ScheduledBreak {
  readonly id: string;
  readonly offset: BreakOffset;
  /** The VAST URL, or the VAST document the VMAP carries. */
  readonly vast: { readonly url: string } | { readonly xml: string };
  /** The VMAP's own beacons: `breakStart`, `breakEnd`, `error`. */
  readonly tracking: readonly { readonly event: string; readonly url: string }[];
}

/** The offset of `timeOffset` (VMAP 1.0.1 §2.4). */
export function breakOffset(value: string | null): BreakOffset | null {
  const trimmed = value?.trim() ?? '';
  if (trimmed === 'start' || trimmed === 'end') return trimmed;
  if (trimmed.endsWith('%')) {
    const percent = Number(trimmed.slice(0, -1));
    return Number.isFinite(percent) ? { percent } : null;
  }
  if (trimmed.startsWith('#')) {
    const position = Number(trimmed.slice(1));
    return Number.isInteger(position) ? { position } : null;
  }
  const time = clock(trimmed);
  return time === undefined ? null : { time };
}

/** The breaks of a VMAP document, in document order, or null when the text is not VMAP. */
export function parseVmap(xml: string, base: string): ScheduledBreak[] | null {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const root = doc.documentElement;
  if (root === null || root.localName !== 'VMAP') return null;
  const out: ScheduledBreak[] = [];
  let index = 0;
  for (const entry of Array.from(root.children).filter((e) => e.localName === 'AdBreak')) {
    index += 1;
    const types = (entry.getAttribute('breakType') ?? 'linear').split(',');
    const offset = breakOffset(entry.getAttribute('timeOffset'));
    if (!types.includes('linear') || offset === null) continue;
    const source = Array.from(entry.children).find((e) => e.localName === 'AdSource');
    const tag =
      source === undefined
        ? undefined
        : Array.from(source.children).find((e) => e.localName === 'AdTagURI');
    const data =
      source === undefined
        ? undefined
        : Array.from(source.children).find((e) => e.localName === 'VASTAdData');
    const vastElement =
      data === undefined
        ? undefined
        : Array.from(data.children).find((e) => e.localName === 'VAST');
    const url = tag?.textContent?.trim();
    let vast: ScheduledBreak['vast'] | null = null;
    if (url !== undefined && url !== '') vast = { url: new URL(url, base).href };
    else if (vastElement !== undefined)
      vast = { xml: new XMLSerializer().serializeToString(vastElement) };
    if (vast === null) continue;
    const events = Array.from(entry.children).find((e) => e.localName === 'TrackingEvents');
    const tracking = (events === undefined ? [] : Array.from(events.children)).flatMap((e) => {
      const event = e.getAttribute('event');
      const target = e.textContent?.trim();
      return event === null || target === undefined || target === ''
        ? []
        : [{ event, url: target }];
    });
    out.push({ id: entry.getAttribute('breakId') ?? `break-${index}`, offset, vast, tracking });
  }
  return out;
}

/** The programme time of an offset, or null when it needs what is not known yet. */
export function offsetTime(
  offset: BreakOffset,
  duration: number,
  chapters: readonly number[] = [],
): number | null {
  if (offset === 'start') return 0;
  if (offset === 'end') return Number.isFinite(duration) ? duration : null;
  if ('time' in offset) return offset.time;
  if ('percent' in offset)
    return Number.isFinite(duration) ? (duration * offset.percent) / 100 : null;
  return chapters[offset.position - 1] ?? null;
}
