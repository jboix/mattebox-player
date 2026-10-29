/**
 * Beacons: the URLs an ad asks the player to request when something
 * happens, with their macros filled (VAST 4.3 §6). Each is sent once, and
 * its answer is not read.
 */

/** What the macros of a beacon read. */
export interface MacroValues {
  /** VAST error code, for `[ERRORCODE]`. */
  readonly errorCode?: number;
  /** Seconds into the programme, for `[MEDIAPLAYHEAD]` and VAST 3's `[CONTENTPLAYHEAD]`. */
  readonly mediaPlayhead?: number;
  /** Seconds into the ad, for `[ADPLAYHEAD]`. */
  readonly adPlayhead?: number;
  /** The media file that plays, for `[ASSETURI]`. */
  readonly assetUri?: string;
  /** 1 before the programme, 2 during it, 3 after it, for `[BREAKPOSITION]`. */
  readonly breakPosition?: 1 | 2 | 3;
  /** The player's width and height in CSS pixels, for `[PLAYERSIZE]`. */
  readonly playerSize?: readonly [number, number];
}

/** `HH:MM:SS.mmm`, the time form VAST macros take. */
function timecode(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const pad = (n: number, width = 2): string => String(n).padStart(width, '0');
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}.${pad(ms % 1000, 3)}`;
}

/** The beacon URL with every macro filled. A macro the player cannot fill becomes -1, as VAST 4.3 §6.1 asks. */
export function expand(url: string, values: MacroValues): string {
  return url.replace(/\[([A-Z_]+)\]/g, (_, name: string) => {
    const value = ((): string | undefined => {
      switch (name) {
        case 'CACHEBUSTING':
          return String(Math.floor(10_000_000 + Math.random() * 89_999_999));
        case 'TIMESTAMP':
          return new Date().toISOString();
        case 'ERRORCODE':
          return values.errorCode === undefined ? undefined : String(values.errorCode);
        case 'MEDIAPLAYHEAD':
        case 'CONTENTPLAYHEAD':
          return values.mediaPlayhead === undefined ? undefined : timecode(values.mediaPlayhead);
        case 'ADPLAYHEAD':
          return values.adPlayhead === undefined ? undefined : timecode(values.adPlayhead);
        case 'ASSETURI':
          return values.assetUri;
        case 'BREAKPOSITION':
          return values.breakPosition === undefined ? undefined : String(values.breakPosition);
        case 'PLAYERSIZE':
          return values.playerSize === undefined ? undefined : values.playerSize.join(',');
        default:
          return undefined;
      }
    })();
    return encodeURIComponent(value ?? '-1');
  });
}

/**
 * Requests a beacon. `no-cors`, because an ad server rarely answers with
 * CORS headers, and `keepalive`, so one sent as the page closes still
 * goes.
 */
export function send(url: string): void {
  try {
    void fetch(url, { mode: 'no-cors', keepalive: true, credentials: 'include' }).catch(() => {});
  } catch {
    // A URL fetch refuses is the ad server's mistake; the ad plays on.
  }
}
