/**
 * The styles and helpers the two elements share, copied from the player:
 * the button and slider styles, the glyph slots, the part helper, the label
 * template, and the time format. The player exports none of them, on
 * purpose: a control of the page's own carries its own, and so does this
 * package. The tokens come through the `--mbx-*` custom properties the
 * player sets, which inherit into every control.
 */
import BUTTON_STYLE_CSS from './button.css?inline';
import SLIDER_STYLE_CSS from './slider.css?inline';

export const BUTTON_STYLE = BUTTON_STYLE_CSS;

/** The style of a slider: the rail, the track with its fill, and the thumb. */

/** The style of a slider: the rail, the track with its fill, and the thumb. */
export const SLIDER_STYLE = SLIDER_STYLE_CSS;

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
