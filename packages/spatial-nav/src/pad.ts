/**
 * The buttons of a game controller, the makes the player tells apart, and
 * the default mapping from buttons to the player's actions.
 *
 * Buttons are named by place, not by letter: `south` is the lower face
 * button on every make, A on an Xbox pad, Cross on a PlayStation pad and B
 * on a Nintendo pad. The indices are the Gamepad API's `standard` layout.
 *
 * No console maker publishes a mapping for a video player. The defaults
 * follow what their own video apps share: the lower face button selects and
 * the right one goes back, Nintendo's the other way round as its letters
 * are; the shoulders go to the previous and next item; the triggers scan
 * while held.
 */

/** A button of a controller in the standard layout, by place. */
export type PadButton =
  | 'south'
  | 'east'
  | 'west'
  | 'north'
  | 'lb'
  | 'rb'
  | 'lt'
  | 'rt'
  | 'select'
  | 'start'
  | 'ls'
  | 'rs'
  | 'up'
  | 'down'
  | 'left'
  | 'right';

/** Every button, in the standard layout's order: the index is the button's. */
export const BUTTONS: readonly PadButton[] = [
  'south',
  'east',
  'west',
  'north',
  'lb',
  'rb',
  'lt',
  'rt',
  'select',
  'start',
  'ls',
  'rs',
  'up',
  'down',
  'left',
  'right',
];

/** An action of the player a button can take. A page may name its own, which only fires the event. */
export type PadAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'activate'
  | 'back'
  | 'play-pause'
  | 'previous'
  | 'next'
  | 'rewind'
  | 'fast-forward'
  | 'subtitles'
  | 'mute'
  | 'fullscreen'
  | 'help';

/**
 * A mapping from buttons to actions: a `PadAction`, or a name of the
 * page's own, which only fires `gamepadaction`. Null unbinds a button.
 */
export type PadMap = Partial<Record<PadButton, string | null>>;

/** The makes of controller whose buttons are drawn differently. */
export type PadKind = 'xbox' | 'playstation' | 'nintendo';

/** The default mapping, for an Xbox or PlayStation pad. */
const DEFAULTS: Readonly<Record<PadButton, PadAction | null>> = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  south: 'activate',
  east: 'back',
  west: null,
  north: 'subtitles',
  lb: 'previous',
  rb: 'next',
  lt: 'rewind',
  rt: 'fast-forward',
  select: 'help',
  start: 'play-pause',
  ls: null,
  rs: null,
};

/** The default mapping for `kind`: a Nintendo pad selects with the right face button, its A. */
export function defaults(kind: PadKind): Record<PadButton, PadAction | null> {
  // Object.assign, not a spread: the ES2015 build would lower a spread into a helper.
  const map: Record<PadButton, PadAction | null> = Object.assign({}, DEFAULTS);
  if (kind === 'nintendo') {
    map.south = 'back';
    map.east = 'activate';
  }
  return map;
}

/** The USB vendor ids of the makers whose pads are drawn differently, as four hex digits. */
const VENDORS: Readonly<Record<string, PadKind>> = { '054c': 'playstation', '057e': 'nintendo' };

/** Words in a pad's id that give its make away where no vendor id is reported. */
const NAMES: ReadonlyArray<readonly [RegExp, PadKind]> = [
  [/dualsense|dualshock|playstation|\bps[345]\b/i, 'playstation'],
  [/nintendo|switch|joy-?con|pro controller/i, 'nintendo'],
];

/**
 * The make of a pad, from the id the browser reports: Chromium writes
 * `Vendor: 054c`, Firefox starts the id with `054c-`. Any other pad is
 * taken for an Xbox pad, the layout most pads follow.
 */
export function kindOf(id: string): PadKind {
  const found = /vendor:\s*([0-9a-f]{4})/i.exec(id) ?? /^([0-9a-f]{4})-[0-9a-f]{4}-/i.exec(id);
  const vendor = found?.[1]?.toLowerCase();
  if (vendor !== undefined) return VENDORS[vendor] ?? 'xbox';
  for (const [words, kind] of NAMES) if (words.test(id)) return kind;
  return 'xbox';
}

/** What each make prints on each button, for the controls bubble. */
export const GLYPHS: Readonly<Record<PadKind, Readonly<Record<PadButton, string>>>> = {
  xbox: {
    south: 'A',
    east: 'B',
    west: 'X',
    north: 'Y',
    lb: 'LB',
    rb: 'RB',
    lt: 'LT',
    rt: 'RT',
    select: 'View',
    start: 'Menu',
    ls: 'LS',
    rs: 'RS',
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
  },
  playstation: {
    south: '✕',
    east: '○',
    west: '□',
    north: '△',
    lb: 'L1',
    rb: 'R1',
    lt: 'L2',
    rt: 'R2',
    select: 'Create',
    start: 'Options',
    ls: 'L3',
    rs: 'R3',
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
  },
  nintendo: {
    south: 'B',
    east: 'A',
    west: 'Y',
    north: 'X',
    lb: 'L',
    rb: 'R',
    lt: 'ZL',
    rt: 'ZR',
    select: '−',
    start: '+',
    ls: 'LS',
    rs: 'RS',
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
  },
};

/** The PlayStation symbols by name, for a screen reader, which may not read the symbol. */
export const SPOKEN: Readonly<Record<string, string>> = {
  '✕': 'Cross',
  '○': 'Circle',
  '□': 'Square',
  '△': 'Triangle',
};

/**
 * The overrides in a `map` attribute: `button:action` pairs apart by spaces,
 * as `rb:fast-forward west:mute select:none`. `none` unbinds the button. A
 * pair with an unknown button is left out.
 */
export function parseMap(text: string | null): PadMap {
  const out: PadMap = {};
  for (const pair of (text ?? '').split(/\s+/)) {
    const [button, action] = pair.split(':');
    if (button === undefined || action === undefined || action === '') continue;
    if (!(BUTTONS as readonly string[]).includes(button)) continue;
    out[button as PadButton] = action === 'none' ? null : action;
  }
  return out;
}

/** The mapping for `kind` with the overrides on top. */
export function mapping(
  kind: PadKind,
  ...overrides: readonly PadMap[]
): Record<PadButton, string | null> {
  const out: Record<PadButton, string | null> = defaults(kind);
  for (const layer of overrides) {
    for (const button of BUTTONS) {
      const action = layer[button];
      if (action !== undefined) out[button] = action;
    }
  }
  return out;
}
