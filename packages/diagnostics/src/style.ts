/**
 * The element's stylesheet. The button is drawn the way the player's own
 * buttons are, in a copy: the player's styles are internal, and a control
 * of the page's own carries its own sheet. Tokens come through the
 * `--mbx-*` custom properties the player sets, which inherit through light
 * DOM; the chart colours have defaults here and a page overrides them the
 * same way. Nothing carries `!important`, so a page's `::part()` rule wins.
 */
export const STYLE = `
:host {
  display: inline-flex;
  position: relative;
  --mbx-chart-1: #5aa9e0;
  --mbx-chart-2: #6fbf8f;
  --mbx-chart-3: #d9a83f;
  --mbx-chart-4: #e05a6e;
  --mbx-chart-5: #a98fe0;
}
:host([hidden]) { display: none; }
:host([inline]) { display: block; }
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
:host([inline]) [part~="button"] { display: none; }
[part~="panel"] {
  position: absolute;
  right: 0;
  bottom: 100%;
  box-sizing: border-box;
  width: 560px;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--mbx-text, #f2f3f5);
  background: rgba(16, 17, 20, 0.95);
  border-radius: var(--mbx-radius, 4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  font: 400 12px/1.5 var(--mbx-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  text-align: left;
  white-space: normal;
}
[part~="panel"][hidden] { display: none; }
:host([inline]) [part~="panel"] {
  position: static;
  width: auto;
  max-height: none;
  margin: 0;
  box-shadow: none;
  border-radius: 0;
}
[part~="head"] {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
[part~="tab"], [part~="chart-tab"] {
  font: inherit;
  color: var(--mbx-muted, #9aa0a6);
  background: transparent;
  border: 0;
  border-radius: var(--mbx-radius, 4px);
  padding: 3px 8px;
  cursor: pointer;
}
[part~="tab"][aria-selected="true"], [part~="chart-tab"][aria-selected="true"] {
  color: var(--mbx-text, #f2f3f5);
  background: rgba(255, 255, 255, 0.12);
}
[part~="copy"], [part~="close"], [part~="window"] {
  font: inherit;
  color: inherit;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: var(--mbx-radius, 4px);
  padding: 2px 8px;
  cursor: pointer;
}
[part~="copy"] { margin-left: auto; }
[part~="window"] { margin-left: auto; }
[part~="window"] option { color: #000; }
[part~="tab"]:focus-visible, [part~="chart-tab"]:focus-visible, [part~="copy"]:focus-visible,
[part~="close"]:focus-visible, [part~="window"]:focus-visible {
  outline: 2px solid var(--mbx-accent, #5b8cff);
  outline-offset: -2px;
}
[part~="body"] { min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 8px; }
[part~="page"][hidden] { display: none; }
[part~="rows"] { display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; margin: 0; }
[part~="key"] { color: var(--mbx-muted, #9aa0a6); white-space: nowrap; }
[part~="value"] { margin: 0; overflow-wrap: anywhere; }
[part~="heading"] {
  margin: 10px 0 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--mbx-muted, #9aa0a6);
}
[part~="heading"]:first-child { margin-top: 0; }
[part~="note"] { margin: 0; color: var(--mbx-muted, #9aa0a6); }
[part~="chart-tabs"] { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-bottom: 6px; }
[part~="chart"] { display: block; width: 100%; height: 160px; }
[part~="legend"] { display: flex; flex-wrap: wrap; gap: 2px 12px; margin-top: 4px; color: var(--mbx-muted, #9aa0a6); }
[part~="swatch"] { display: inline-block; width: 10px; height: 10px; margin-right: 4px; border-radius: 2px; vertical-align: middle; }
[part~="readout"] { margin-top: 4px; }
[part~="table"] { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
[part~="cell"] { padding: 2px 6px; text-align: left; border-bottom: 1px solid rgba(255, 255, 255, 0.08); white-space: nowrap; font-weight: 400; }
[part~="label"] { color: var(--mbx-muted, #9aa0a6); }
[part~="ok"] { color: var(--mbx-chart-2); }
[part~="bad"] { color: var(--mbx-chart-4); }
[part~="na"] { color: var(--mbx-muted, #9aa0a6); }
[part~="ok"], [part~="bad"], [part~="na"], [part~="maybe"] { font-weight: 600; }
`;
