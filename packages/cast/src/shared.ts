/**
 * The style and helpers of the cast button, copied from the player: the
 * button style and the glyph slots. The player exports none of them, on
 * purpose: a control of the page's own carries its own, and so does this
 * package. The tokens come through the `--mbx-*` custom properties the
 * player sets, which inherit into every control.
 */
import BUTTON_STYLE_CSS from './button.css?inline';

export const BUTTON_STYLE = BUTTON_STYLE_CSS;

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
