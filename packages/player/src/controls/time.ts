/** Time as the bar shows it and as a screen reader hears it. Pure, node-tested. */

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** `m:ss`, or `h:mm:ss` from an hour up. Anything not a finite positive number reads as zero. */
export function format(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

/** A wall-clock time in the viewer's locale, seconds included: "14:23:05". */
export function clock(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** What a screen reader hears for a position: "1:23 of 4:56", or the position alone when the duration is unknown or infinite. */
export function describe(current: number, duration: number): string {
  return Number.isFinite(duration) ? `${format(current)} of ${format(duration)}` : format(current);
}
