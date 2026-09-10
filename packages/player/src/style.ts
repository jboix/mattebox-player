/**
 * The default styles of the element itself: the stage, fullscreen, and the
 * error surface under native controls. Every control carries its own sheet.
 * Two rules govern them.
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
  outline: none;
  --mbx-surface: #101114;
  --mbx-text: #f2f3f5;
  --mbx-muted: #9aa0a6;
  --mbx-accent: #5b8cff;
  --mbx-error: #ffb4ab;
  --mbx-live: #ff4d4d;
  --mbx-radius: 4px;
  --mbx-gap: 10px;
  --mbx-pad: 8px;
  --mbx-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
[part~="stage"] { position: relative; }
/* 16:9 until the media says otherwise: a bare video measures 300 by 150 and
   would jump to its size on metadata. Auto first, so the natural ratio wins
   once it is known. */
::slotted(video) { display: block; width: 100%; aspect-ratio: auto 16 / 9; }
:host(:focus-visible) [part~="stage"] { outline: 2px solid var(--mbx-accent); outline-offset: -2px; }
/* Fullscreen goes on the host, so every control the page placed inside
   comes along. The stage takes the height and the video sits in it. */
:host(:fullscreen) { display: flex; flex-direction: column; background: #000; }
:host(:fullscreen) [part~="stage"] { flex: 1; min-height: 0; display: flex; }
:host(:fullscreen) ::slotted(video) { height: 100%; object-fit: contain; }
:host(:-webkit-full-screen) { display: flex; flex-direction: column; background: #000; }
:host(:-webkit-full-screen) [part~="stage"] { flex: 1; min-height: 0; display: flex; }
:host(:-webkit-full-screen) ::slotted(video) { height: 100%; object-fit: contain; }
[part~="error"] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--mbx-gap);
  padding: var(--mbx-pad);
  background: var(--mbx-surface);
  color: var(--mbx-error);
  font: 400 13px/1.4 var(--mbx-font);
}
[part~="value"] { color: var(--mbx-accent); }
[part~="button"] {
  font: inherit;
  color: inherit;
  background: transparent;
  border: 1px solid currentColor;
  border-radius: var(--mbx-radius);
  padding: 2px 6px;
}
[hidden] { display: none; }
`;
