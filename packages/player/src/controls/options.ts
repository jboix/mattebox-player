/**
 * The bar's knobs. Every one has a default, every one can come from
 * JavaScript through `define({ controls })` or the constructor, and every
 * one has an attribute in kebab-case that wins over both, so a page that
 * writes only markup still gets to set them.
 */

export interface ControlsOptions {
  /** Milliseconds of pointer stillness before the bar hides while playing. */
  readonly idleMs?: number;
  /** Seconds an arrow key moves the playhead. */
  readonly seekStep?: number;
  /** Seconds Page Up and Page Down move it. */
  readonly seekPage?: number;
  /** Seconds the skip-back button moves it. Zero leaves that button out. */
  readonly skipBack?: number;
  /** Seconds the skip-forward button moves it. Zero leaves that button out. */
  readonly skipForward?: number;
  /** Whether the large play sits over the picture while paused. Zero leaves it out. */
  readonly start?: number;
  /**
   * How many forward buffer goals long the availability window must be for
   * a live stream to be seekable. Below it the bar shows no seek bar: a
   * window barely wider than the buffer is nowhere to go. Zero makes every
   * live stream seekable.
   */
  readonly liveWindow?: number;
  /**
   * Which controls the buttons row carries, in order, by name, with `|`
   * between the left and the right cluster. A name left out is a control
   * left out. See LAYOUT for the default and the names.
   */
  readonly layout?: string;
}

export type Controls = Required<ControlsOptions>;

/** The buttons row by default. `drm`, the lock, is a control the row can carry and does not by default. */
export const LAYOUT =
  'skip-back play skip-forward volume | speed subtitles audio quality pip fullscreen';

export const DEFAULTS: Controls = {
  idleMs: 3000,
  seekStep: 5,
  seekPage: 30,
  skipBack: 10,
  skipForward: 10,
  start: 1,
  liveWindow: 3,
  layout: LAYOUT,
};

/** Each option's attribute. */
export const ATTRIBUTES: Readonly<Record<keyof Controls, string>> = {
  idleMs: 'idle-ms',
  seekStep: 'seek-step',
  seekPage: 'seek-page',
  skipBack: 'skip-back',
  skipForward: 'skip-forward',
  start: 'start',
  liveWindow: 'live-window',
  layout: 'layout',
};

type Numeric = Exclude<keyof Controls, 'layout'>;
const NUMERIC = (Object.keys(DEFAULTS) as ReadonlyArray<keyof Controls>).filter(
  (key): key is Numeric => key !== 'layout',
);

/** The attribute where it is a non-negative number, else the option, else the default; the layout as given. */
export function resolve(
  options: ControlsOptions | undefined,
  attribute: (name: string) => string | null,
): Controls {
  const out: Record<string, number | string> = {};
  for (const key of NUMERIC) {
    const raw = attribute(ATTRIBUTES[key]);
    const set = raw === null ? Number.NaN : Number(raw);
    const given = options?.[key];
    out[key] =
      Number.isFinite(set) && set >= 0
        ? set
        : given !== undefined && Number.isFinite(given) && given >= 0
          ? given
          : DEFAULTS[key];
  }
  out.layout = attribute(ATTRIBUTES.layout) ?? options?.layout ?? DEFAULTS.layout;
  return out as unknown as Controls;
}

/** A layout as two lists of names, left and right of the `|`. Unknown names are the caller's to drop. */
export function clusters(layout: string): [string[], string[]] {
  const [left = '', right = ''] = layout.split('|');
  const names = (part: string): string[] => part.split(/\s+/).filter((name) => name !== '');
  return [names(left), names(right)];
}
