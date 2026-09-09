/**
 * The default styles. Two rules govern them.
 *
 * Nothing carries `!important`. For normal declarations the outer tree wins
 * over the shadow tree, so any `::part()` rule the page writes beats these
 * whatever its specificity; an `!important` here would invert that and make
 * a part unstylable.
 *
 * Selectors stay at one attribute, and every element is reached through its
 * `part`, so the names in the stylesheet are the names the page uses.
 */
export const STYLE = `
:host {
  display: block;
  position: relative;
  --mbx-surface: #101114;
  --mbx-text: #f2f3f5;
  --mbx-muted: #9aa0a6;
  --mbx-accent: #5b8cff;
  --mbx-error: #ffb4ab;
  --mbx-radius: 4px;
  --mbx-gap: 10px;
  --mbx-pad: 8px;
  --mbx-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
::slotted(video) { display: block; width: 100%; }
[part~="panels"], [part~="error"] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--mbx-gap);
  padding: var(--mbx-pad);
  background: var(--mbx-surface);
  color: var(--mbx-text);
  font: 400 13px/1.4 var(--mbx-font);
}
[part~="panels"]:empty { display: none; }
[part~="panel"] { display: flex; align-items: center; gap: 6px; }
[part~="label"] { display: flex; align-items: center; gap: 6px; }
[part~="text"] { color: var(--mbx-muted); }
[part~="value"] { color: var(--mbx-accent); }
[part~="select"], [part~="button"] {
  font: inherit;
  color: inherit;
  background: transparent;
  border: 1px solid currentColor;
  border-radius: var(--mbx-radius);
  padding: 2px 6px;
}
[part~="button"][disabled] { opacity: 0.5; }
[part~="error"] { color: var(--mbx-error); }
[hidden] { display: none; }
`;
