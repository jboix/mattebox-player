/**
 * @mattebox/player-diagnostics: <mbx-diagnostics>, a control for the
 * player's bar, or a panel under the video, that shows what the session
 * is doing and what the browser can do, and writes a report. Importing
 * this module registers the element; that is the package's one side
 * effect. It reaches the player only through the contract a control of
 * the page's own has, and the engine through its public surface.
 */
import { MbxDiagnostics } from './element.js';

export { MbxDiagnostics } from './element.js';
export type { DiagnosticsReport, EngineReport, PlaybackReport } from './report.js';
export type { Counters, Mark, Sample } from './sampler.js';
export type { CodecRow, DrmRow, PlatformRow, Support } from './support.js';
export { probeSupport } from './support.js';

export const DIAGNOSTICS = 'mbx-diagnostics';

if (customElements.get(DIAGNOSTICS) === undefined) {
  customElements.define(DIAGNOSTICS, MbxDiagnostics);
}

declare global {
  interface HTMLElementTagNameMap {
    'mbx-diagnostics': MbxDiagnostics;
  }
}
