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
[part~="controls"] {
  position: absolute;
  inset: auto 0 0 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 40px 16px 12px;
  color: var(--mbx-text);
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
  font: 500 16px/1.2 var(--mbx-font);
  transition: opacity 0.2s;
}
[part~="idle"] { opacity: 0; pointer-events: none; }
[part~="error-screen"] {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.75);
  color: var(--mbx-text);
  font: 400 15px/1.4 var(--mbx-font);
  text-align: center;
}
[part~="error-box"] { display: flex; flex-direction: column; align-items: center; gap: 8px; }
[part~="error-title"] { font-size: 18px; font-weight: 600; }
[part~="error-detail"] { font-family: monospace; font-size: 13px; color: var(--mbx-error); }
[part~="error-retry"] { width: auto; height: 36px; padding: 0 16px; border: 1px solid currentColor; font-weight: 600; }
[part~="row"] { display: flex; align-items: center; gap: 8px; }
[part~="seek-row"] { gap: 16px; }
[part~="current-time"], [part~="duration"] { min-width: 3ch; font-variant-numeric: tabular-nums; white-space: nowrap; }
[part~="duration"] { text-align: right; }
[part~="control"] {
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
[part~="control"]:hover { opacity: 1; }
[part~="start-button"] {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 96px;
  height: 96px;
  margin: -48px 0 0 -48px;
  color: var(--mbx-text);
  opacity: 0.92;
  filter: drop-shadow(0 2px 10px rgba(0, 0, 0, 0.6));
  transition: opacity 0.15s;
}
[part~="start-button"]:hover { opacity: 1; }
[part~="start-button"] [part~="icon"] { width: 72px; height: 72px; }
[part~="error-screen"] {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.75);
  color: var(--mbx-text);
  font: 400 15px/1.4 var(--mbx-font);
  text-align: center;
}
[part~="error-box"] { display: flex; flex-direction: column; align-items: center; gap: 8px; }
[part~="error-title"] { font-size: 18px; font-weight: 600; }
[part~="error-detail"] { font-family: monospace; font-size: 13px; color: var(--mbx-error); }
[part~="error-retry"] { width: auto; height: 36px; padding: 0 16px; border: 1px solid currentColor; font-weight: 600; }
[part~="row"] { display: flex; align-items: center; gap: 8px; }
[part~="seek-row"] { gap: 16px; }
[part~="current-time"], [part~="duration"] { min-width: 3ch; font-variant-numeric: tabular-nums; white-space: nowrap; }
[part~="duration"] { text-align: right; }
[part~="control"] {
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
[part~="control"]:hover { opacity: 1; }
[part~="start-button"] {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 104px;
  height: 64px;
  margin: -32px 0 0 -52px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: var(--mbx-radius);
  background: rgba(0, 0, 0, 0.45);
  color: var(--mbx-text);
  opacity: 0.9;
  transition: opacity 0.15s, background 0.15s;
}
[part~="start-button"]:hover { opacity: 1; background: rgba(0, 0, 0, 0.6); }
[part~="start-button"] [part~="icon"] { width: 40px; height: 40px; margin-left: 2px; }
[part~="icon"] { width: 1.75em; height: 1.75em; fill: currentColor; }
[part~="slider"] {
  position: relative;
  flex: none;
  height: 40px;
  border-radius: var(--mbx-radius);
  cursor: pointer;
  touch-action: none;
}
[part~="rail"] { position: absolute; top: 0; bottom: 0; left: 8px; right: 8px; }
[part~="seek"] { flex: 1; }
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
  width: 16px;
  height: 16px;
  margin: -8px 0 0 -8px;
  border-radius: 50%;
  background: var(--mbx-text);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  pointer-events: none;
}
[part~="buffered"] { position: absolute; top: 0; right: 0; bottom: 0; left: 0; }
[part~="buffered-range"] { position: absolute; top: 0; bottom: 0; background: rgba(255, 255, 255, 0.3); }
[part~="hover"] { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--mbx-text); }
[part~="edge"] { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--mbx-live); }
[part~="preview"] {
  position: absolute;
  bottom: 100%;
  margin-bottom: 4px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: var(--mbx-surface);
  border-radius: var(--mbx-radius);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
}
[part~="preview-image"] { position: relative; overflow: hidden; border-radius: 2px; }
[part~="preview-tile"] { position: absolute; top: 0; left: 0; transform-origin: top left; background-repeat: no-repeat; }
[part~="preview-time"] { padding: 0 4px; }
[part~="volume-group"] { display: flex; align-items: center; }
[part~="volume"] { width: 0; opacity: 0; transition: width 0.2s ease, opacity 0.2s ease; }
/* Two attributes in one selector, the one place: the slider unfolds from
   its group under the pointer or focus, and a page reaches it through
   ::part(volume) all the same. */
[part~="volume-group"]:hover [part~="volume"] { width: 80px; opacity: 1; }
[part~="volume-group"]:focus-within [part~="volume"] { width: 80px; opacity: 1; }
[part~="cluster"] { display: flex; align-items: center; gap: 4px; margin-left: auto; }
[part~="live-button"] { width: auto; gap: 6px; padding: 0 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; }
[part~="live-button"]:disabled { cursor: default; opacity: 1; }
[part~="live-dot"] { width: 10px; height: 10px; border-radius: 50%; background: var(--mbx-muted); transition: background 0.2s; }
/* Two attributes, as with the volume: the dot reads the button's state. */
[part~="live-dot"][part~="at-edge"] { background: var(--mbx-live); box-shadow: 0 0 6px var(--mbx-live); }
[part~="slot"] { display: contents; }
[part~="menu"] { position: relative; }
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
[part~="drm-badge"] { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; color: var(--mbx-muted); border-radius: var(--mbx-radius); cursor: default; }
[part~="drm-badge"]:focus-visible { outline: 2px solid var(--mbx-accent); outline-offset: -2px; }
[part~="tooltip"] {
  position: absolute;
  right: 0;
  bottom: 100%;
  margin-bottom: 8px;
  padding: 8px 10px;
  background: rgba(16, 17, 20, 0.95);
  border-radius: var(--mbx-radius);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  color: var(--mbx-text);
  font-size: 13px;
  line-height: 1.4;
  text-align: left;
  white-space: nowrap;
  pointer-events: none;
}
[part~="tooltip-title"] { font-weight: 600; }
[part~="tooltip-text"] { color: var(--mbx-muted); }
[part~="track"] {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 4px;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.3);
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
:host(:focus-visible) [part~="stage"] { outline: 2px solid var(--mbx-accent); outline-offset: -2px; }
[part~="control"]:focus-visible { outline: 2px solid var(--mbx-accent); outline-offset: -2px; }
[part~="slider"]:focus-visible { outline: 2px solid var(--mbx-accent); outline-offset: -2px; }
[part~="stage"]:fullscreen { display: flex; background: #000; }
[part~="stage"]:fullscreen ::slotted(video) { height: 100%; object-fit: contain; }
[part~="stage"]:-webkit-full-screen { display: flex; background: #000; }
[part~="stage"]:-webkit-full-screen ::slotted(video) { height: 100%; object-fit: contain; }
@media (prefers-reduced-motion: reduce) {
  [part~="controls"] { transition: none; }
  [part~="volume"] { transition: none; }
  [part~="live-dot"] { transition: none; }
  [part~="start-button"] { transition: none; }
}
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
