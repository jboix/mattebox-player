/**
 * The styles and helpers the two elements share, copied from the player:
 * the button and slider styles, the glyph slots, the part helper, the label
 * template, and the time format. The player exports none of them, on
 * purpose: a control of the page's own carries its own, and so does this
 * package. The tokens come through the `--mbx-*` custom properties the
 * player sets, which inherit into every control.
 */

export const BUTTON_STYLE = `
:host { display: inline-flex; }
:host([hidden]) { display: none; }
[part~="button"] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 40px;
  height: 40px;
  padding: 0;
  font: inherit;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: var(--mbx-radius);
  cursor: pointer;
  opacity: 0.9;
}
[part~="button"]:hover { opacity: 1; }
[part~="button"]:focus-visible { outline: 2px solid var(--mbx-accent); outline-offset: -2px; }
[part~="icon"], ::slotted(*) { width: 1.75em; height: 1.75em; fill: currentColor; }
slot[hidden] { display: none; }
`;

/** The style of a slider: the rail, the track with its fill, and the thumb. */

/** The style of a slider: the rail, the track with its fill, and the thumb. */
export const SLIDER_STYLE = `
:host { display: block; }
:host([hidden]) { display: none; }
[part~="slider"] {
  position: relative;
  height: 40px;
  border-radius: var(--mbx-radius);
  cursor: pointer;
  touch-action: none;
}
[part~="slider"]:focus-visible { outline: 2px solid var(--mbx-accent); outline-offset: -2px; }
[part~="rail"] { position: absolute; top: 0; bottom: 0; left: 8px; right: 8px; }
[part~="track"] {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 4px;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.35);
  border-radius: 2px;
  overflow: hidden;
}
[part~="fill"] { position: absolute; top: 0; bottom: 0; left: 0; background: var(--mbx-accent); }
[part~="thumb"] {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 50%;
  background: var(--mbx-text);
  pointer-events: none;
}
`;

/** A `<style>` with `text`, for a shadow root. */
export function style(text: string): HTMLStyleElement {
  const node = document.createElement('style');
  node.textContent = text;
  return node;
}

/**
 * A named slot per state with the default glyph as its fallback, so a page
 * drops its own SVG into `slot="icon-<state>"` and the button keeps the
 * name. Returns the slots by state; `show` hides all but one.
 */
export function iconSlots<S extends string>(
  states: readonly S[],
  fallback: (state: S) => SVGSVGElement,
): Record<S, HTMLSlotElement> {
  const out = {} as Record<S, HTMLSlotElement>;
  for (const state of states) {
    const slot = document.createElement('slot');
    slot.name = `icon-${state}`;
    slot.append(fallback(state));
    slot.hidden = true;
    out[state] = slot;
  }
  return out;
}

export function show<S extends string>(slots: Record<S, HTMLSlotElement>, state: S): void {
  for (const key of Object.keys(slots) as S[]) slots[key].hidden = key !== state;
}

/** An element with its part names, and its text when it has any. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  part: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.setAttribute('part', part);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match: string, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}

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

/** What a screen reader hears for a position: "1:23 of 4:56", or the position alone when the duration is unknown or infinite. */
export function describe(current: number, duration: number): string {
  return Number.isFinite(duration) ? `${format(current)} of ${format(duration)}` : format(current);
}
