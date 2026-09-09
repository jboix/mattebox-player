/**
 * The DRM indicator over `engine.drm`. Present only when the EME stages are
 * composed. It shows the key system in use and nothing else: sessions and key
 * statuses are diagnostics, and the element is not a diagnostics surface.
 */

import type { DrmApi } from 'mattebox/stages/eme-core';
import { el } from '../dom.js';
import { namespaces } from '../namespaces.js';
import type { Panel, PanelFactory } from './panel.js';

export const drmPanel: PanelFactory = (session): Panel | null => {
  const engine = session.engine;
  if (engine === null) return null;
  const found = namespaces(engine).drm;
  if (found === undefined) return null;
  const drm: DrmApi = found;

  const root = el('div', 'panel drm');
  root.append(el('span', 'text drm-text', 'DRM'));
  const keySystem = el('span', 'value drm-key-system');
  root.append(keySystem);

  function render(): void {
    const name = drm.keySystem;
    keySystem.textContent = name ?? '';
    // Nothing to show until a key session opens, and an empty indicator is
    // worse than none.
    root.hidden = name === null;
  }

  const off = engine.on('drm:keysystem', render);
  render();

  return {
    root,
    dispose(): void {
      off();
    },
  };
};
