/**
 * The audio and text menus over `engine.tracks`. Always composed, so the
 * panel is always there for an engine session; each menu hides itself while
 * its content type has no tracks.
 *
 * Text carries an "off" option because a text selection is releasable and an
 * audio one is not: the engine always keeps a video and an audio selection.
 */
import type { ContentType, Track } from 'mattebox';
import { el, fill, menu } from '../dom.js';
import type { Panel, PanelFactory } from './panel.js';

const OFF = 'off';

/** The language, then the role, then the id: whichever the manifest gave. */
function label(track: Track): string {
  const parts = [track.lang, track.role].filter((part) => part !== undefined);
  return parts.length === 0 ? track.id : parts.join(' · ');
}

export const tracksPanel: PanelFactory = (session): Panel | null => {
  const engine = session.engine;
  if (engine === null) return null;
  const tracks = engine.tracks;

  const root = el('div', 'panel tracks');
  const [audioLabel, audio] = menu('audio', 'Audio');
  const [textLabel, text] = menu('text', 'Subtitles');
  root.append(audioLabel, textLabel);

  function renderOne(
    select: HTMLSelectElement,
    wrapper: HTMLElement,
    contentType: ContentType,
    off: boolean,
  ): number {
    const available = tracks.available.filter((track) => track.contentType === contentType);
    const items: Array<readonly [string, string]> = off ? [[OFF, 'Off']] : [];
    for (const track of available) items.push([track.id, label(track)]);
    fill(select, items, tracks.active(contentType)?.id ?? OFF);
    wrapper.hidden = available.length === 0;
    return available.length;
  }

  function render(): void {
    const count =
      renderOne(audio, audioLabel, 'audio', false) + renderOne(text, textLabel, 'text', true);
    root.hidden = count === 0;
  }

  audio.addEventListener('change', () => {
    tracks.select(audio.value);
  });
  text.addEventListener('change', () => {
    if (text.value === OFF) tracks.deselect('text');
    else tracks.select(text.value);
  });

  const offs = [engine.on('tracks:changed', render), engine.on('tracks:selected', render)];
  render();

  return {
    root,
    dispose(): void {
      for (const off of offs) off();
    },
  };
};
