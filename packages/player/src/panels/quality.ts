/**
 * The quality menu over `engine.quality`. Always composed, so the panel is
 * always there for an engine session.
 *
 * The menu holds the pin, where "auto" means no pin, and a separate readout
 * holds what is decoding now. They are different on purpose: after a switch
 * the engine appends the new rendition while the viewer still watches
 * buffered media from the old one, so a menu must tick `playing`, not
 * `active`. See the engine's `QualityApi`.
 */
import type { Rendition } from 'mattebox';
import { el, fill, menu } from '../dom.js';
import type { Panel, PanelFactory } from './panel.js';

const AUTO = 'auto';

/** A rendition's height when the manifest declared one, its bitrate otherwise. */
function label(rendition: Rendition): string {
  if (rendition.height !== undefined) return `${rendition.height}p`;
  return `${Math.round(rendition.bitrate / 1000)} kbps`;
}

export const qualityPanel: PanelFactory = (session, video): Panel | null => {
  const engine = session.engine;
  if (engine === null) return null;
  const quality = engine.quality;

  const root = el('div', 'panel quality');
  const [wrapper, select] = menu('quality', 'Quality');
  const playing = el('span', 'value quality-playing');
  root.append(wrapper, playing);

  let shown = '';
  function render(): void {
    const items: Array<readonly [string, string]> = [[AUTO, 'Auto']];
    for (const rendition of quality.renditions) items.push([rendition.id, label(rendition)]);
    fill(select, items, quality.pinned ?? AUTO);
    root.hidden = quality.renditions.length === 0;
  }

  function tick(): void {
    const current = quality.playing === null ? '' : label(quality.playing);
    if (current === shown) return;
    shown = current;
    playing.textContent = current;
  }

  select.addEventListener('change', () => {
    if (select.value === AUTO) quality.auto();
    else quality.pin(select.value);
  });

  const offs = [
    engine.on('tracks:changed', render),
    engine.on('quality:constraints-unsatisfiable', render),
    engine.on('quality:pin-unsatisfiable', render),
  ];
  // No event reports the playing rendition: it is derived from currentTime
  // against the append log, so the element reads it on the clock the video
  // already ticks. See docs/integrator-log.md.
  video.addEventListener('timeupdate', tick);
  render();
  tick();

  return {
    root,
    dispose(): void {
      for (const off of offs) off();
      video.removeEventListener('timeupdate', tick);
    },
  };
};
