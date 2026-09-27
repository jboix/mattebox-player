/**
 * The style every button control shares. Each element carries its own
 * copy in its shadow root, so the rules are short and the tokens come
 * through the `--mbx-*` custom properties the player sets, which inherit
 * through light DOM into every control.
 *
 * Nothing carries `!important`: a page's `::part()` rule must win.
 */
import BUTTON_STYLE_CSS from './button.css?inline';
import MENU_STYLE_CSS from './menu.css?inline';
import SLIDER_STYLE_CSS from './slider.css?inline';
export const BUTTON_STYLE = BUTTON_STYLE_CSS;

/** The style of a slider: the rail, the track with its fill, and the thumb. */
export const SLIDER_STYLE = SLIDER_STYLE_CSS;

/** A non-negative number from an attribute, else the default. */
export function number(node: Element, name: string, fallback: number): number {
  const raw = node.getAttribute(name);
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** The style of a menu: the button from BUTTON_STYLE, and the popup above it with its items. */
export const MENU_STYLE = BUTTON_STYLE + MENU_STYLE_CSS;

/** Puts a control in the bar's seek row when it is in a bar, unless the page wrote a `slot` of its own. */
export function seekRow(node: HTMLElement): void {
  if (node.parentElement?.localName === 'mbx-control-bar' && !node.hasAttribute('slot')) {
    node.slot = 'seek';
  }
}

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
