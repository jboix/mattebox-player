/**
 * The style every button control shares. Each element carries its own
 * copy in its shadow root, so the rules are short and the tokens come
 * through the `--mbx-*` custom properties the player sets, which inherit
 * through light DOM into every control.
 *
 * Nothing carries `!important`: a page's `::part()` rule must win.
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

/** A non-negative number from an attribute, else the default. */
export function number(node: Element, name: string, fallback: number): number {
  const raw = node.getAttribute(name);
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** The style of a menu: the button from BUTTON_STYLE, and the popup above it with its items. */
export const MENU_STYLE = `${BUTTON_STYLE}
:host { position: relative; }
[part~="popup"] {
  position: absolute;
  right: 0;
  bottom: 100%;
  margin-bottom: 8px;
  min-width: 160px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: rgba(16, 17, 20, 0.95);
  border-radius: var(--mbx-radius);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  font-size: 14px;
}
[part~="popup"][hidden] { display: none; }
[part~="section"] { display: flex; flex-direction: column; }
[part~="section"] + [part~="section"] { margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.12); }
[part~="section-label"] { padding: 4px 12px 2px; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--mbx-muted); }
[part~="item"] {
  display: block;
  width: 100%;
  padding: 8px 12px 8px 28px;
  font: inherit;
  color: inherit;
  text-align: left;
  white-space: nowrap;
  background: transparent;
  border: 0;
  border-radius: var(--mbx-radius);
  cursor: pointer;
}
[part~="item"]:hover { background: rgba(255, 255, 255, 0.12); }
[part~="item"]:focus-visible { outline: 2px solid var(--mbx-accent); outline-offset: -2px; }
[part~="page-item"] { position: relative; padding-right: 28px; }
[part~="page-item"]::after { content: ""; position: absolute; right: 12px; top: 50%; width: 7px; height: 7px; margin-top: -4px; border: solid currentColor; border-width: 1.5px 1.5px 0 0; transform: rotate(45deg); opacity: 0.7; }
[part~="back-item"] { position: relative; font-weight: 600; border-bottom: 1px solid rgba(255, 255, 255, 0.12); border-radius: 0; margin-bottom: 6px; }
[part~="back-item"]::before { content: ""; position: absolute; left: 12px; top: 50%; width: 7px; height: 7px; margin-top: -4px; border: solid currentColor; border-width: 1.5px 0 0 1.5px; transform: rotate(-45deg); opacity: 0.7; }
[part~="checked"] { position: relative; }
[part~="checked"]::before { content: ""; position: absolute; left: 12px; top: 50%; width: 6px; height: 6px; margin-top: -3px; border-radius: 50%; background: var(--mbx-accent); }
`;

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
