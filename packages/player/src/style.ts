/**
 * The default styles of the element itself: the stage, fullscreen, and the
 * error surface under native controls. Every control carries its own sheet.
 * Two rules govern them.
 *
 * The box is black and the picture is centred in it, letterboxed or
 * pillarboxed by `object-fit: contain`, whatever height or ratio the page
 * gives the element: what fullscreen always did, now the default. With no
 * height from the page the stage is as tall as the picture and none of it
 * shows.
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
  background: #000;
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
/* The stage is a column as tall as the host, so the picture is centred
   in whatever height the page gives, and the panels row under native
   controls keeps its place below the picture. The height comes from the
   page, or from the browser in fullscreen, and not from a display on the
   host: a page's own "mattebox-player { display: block }" beats a :host()
   rule, so nothing here may depend on one. */
[part~="stage"] {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
}
/* 16:9 until the media says otherwise: a bare video measures 300 by 150 and
   would jump to its size on metadata. Auto first, so the natural ratio wins
   once it is known. Capped at the stage, and contained, so a box shorter
   than the picture letterboxes it and a narrower one pillarboxes it. */
::slotted(video) {
  display: block;
  width: 100%;
  min-height: 0;
  max-height: 100%;
  object-fit: contain;
  aspect-ratio: auto 16 / 9;
}
:host(:focus-visible) [part~="stage"] { outline: 2px solid var(--mbx-accent); outline-offset: -2px; }
/* Fullscreen goes on the host, so every control the page placed inside
   comes along. The browser gives the host the whole screen with
   !important; the picture takes what the panels row leaves. The error
   surface, which sits under the stage in the page, goes over its foot
   instead. */
:host(:fullscreen) ::slotted(video) { flex: 1; }
:host(:fullscreen) [part~="error"] { position: absolute; left: 0; right: 0; bottom: 0; }
:host(:-webkit-full-screen) ::slotted(video) { flex: 1; }
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
