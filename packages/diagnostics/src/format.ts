/** The numbers as the panel and the charts print them. Pure. */

/** Bits per second as "3.2 Mbps", "640 kbps" or "0 bps". */
export function bitrate(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return '0 bps';
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(bps >= 10_000_000 ? 0 : 1)} Mbps`;
  if (bps >= 1_000) return `${Math.round(bps / 1_000)} kbps`;
  return `${Math.round(bps)} bps`;
}

/** Seconds as "m:ss", or "h:mm:ss" from an hour up. Anything not finite reads as "–". */
export function clock(seconds: number): string {
  if (!Number.isFinite(seconds)) return '–';
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

/** A number with `digits` decimals, and "–" when it is not one. */
export function fixed(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '–'
    : value.toFixed(digits);
}

/** A share as "1.23%", zero when there is no whole. */
export function share(part: number, whole: number): string {
  return whole > 0 ? `${((part / whole) * 100).toFixed(2)}%` : '0%';
}

/** Time ranges as "0.0–12.3, 40.0–52.1". */
export function ranges(
  list: ReadonlyArray<{ readonly start: number; readonly end: number }>,
): string {
  return list.length === 0
    ? 'none'
    : list.map((range) => `${range.start.toFixed(1)}–${range.end.toFixed(1)}`).join(', ');
}

/** A rendition's name: its height, else its bitrate. */
export function rendition(
  r: { readonly height?: number; readonly bitrate: number } | null,
): string {
  if (r === null) return '–';
  return r.height !== undefined ? `${r.height}p, ${bitrate(r.bitrate)}` : bitrate(r.bitrate);
}
