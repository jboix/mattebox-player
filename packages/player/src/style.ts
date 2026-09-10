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
   comes along. The stage takes the height and the video sits in it. The
   height comes from the browser, which gives the fullscreen element the
   whole screen with !important, and not from a display on the host:
   a page's own "mattebox-player { display: block }" beats a :host()
   rule, so nothing here may depend on one. The error surface, which sits
   under the stage in the page, goes over its foot instead. */
:host(:fullscreen) { background: #000; }
:host(:fullscreen) [part~="stage"] { height: 100%; display: flex; }
:host(:fullscreen) ::slotted(video) { height: 100%; object-fit: contain; }
:host(:fullscreen) [part~="error"] { position: absolute; left: 0; right: 0; bottom: 0; }
:host(:-webkit-full-screen) { background: #000; }
:host(:-webkit-full-screen) [part~="stage"] { height: 100%; display: flex; }
:host(:-webkit-full-screen) ::slotted(video) { height: 100%; object-fit: contain; }
:host(:-webkit-full-screen) [part~="error"] { position: absolute; left: 0; right: 0; bottom: 0; }
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
