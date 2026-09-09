/**
 * The live badge over `engine.live`. Present only when a live stage is
 * composed, so the factory answers null for VOD-only engines and for native.
 *
 * Latency has no event; it moves with the playhead. The video's `timeupdate`
 * is the clock the browser already runs, so the badge reads on that.
 */
import { el, state } from '../dom.js';
import type { LiveApi } from '../namespaces.js';
import { namespaces } from '../namespaces.js';
import type { Panel, PanelFactory } from './panel.js';

export const livePanel: PanelFactory = (session, video): Panel | null => {
  const engine = session.engine;
  if (engine === null) return null;
  const found = namespaces(engine).live;
  if (found === undefined) return null;
  // Annotated, not narrowed: a hoisted function declaration below reads it.
  const live: LiveApi = found;

  const root = el('div', 'panel live');
  const badge = el('span', 'badge live-badge', 'Live');
  const latency = el('span', 'value live-latency');
  const button = el('button', 'button live-edge-button', 'Go to live');
  button.type = 'button';
  root.append(badge, latency, button);

  let shown = '';
  function tick(): void {
    // The namespace is present whenever a live stage was composed, which says
    // nothing about the stream: `full` carries both live adapters, so a VOD
    // presentation has `engine.live` too. A window that never opened leaves
    // `edge` null, and that is what makes a stream live.
    root.hidden = live.edge === null;
    const atEdge = live.atEdge;
    // State rides the part name: `::part()` takes no attribute selector, so
    // `::part(at-edge)` is the only way a page can style the edge state.
    state(root, 'panel live', { 'at-edge': atEdge });
    button.disabled = atEdge;
    const seconds = live.latency;
    const text = seconds === null ? '' : `${seconds.toFixed(1)}s behind`;
    if (text === shown) return;
    shown = text;
    latency.textContent = text;
  }

  button.addEventListener('click', () => {
    live.seekToEdge();
  });
  video.addEventListener('timeupdate', tick);
  tick();

  return {
    root,
    dispose(): void {
      video.removeEventListener('timeupdate', tick);
    },
  };
};
