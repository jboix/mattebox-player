/**
 * <mbx-audio-menu>: the audio track over `engine.tracks`. Hidden unless
 * there is a choice to make, and for a native session. The name comes
 * from `label`. A track reads as its language, then its role, then its
 * id: whichever the manifest gave.
 */
import type { ContentType, Mattebox, Track } from 'mattebox';
import type { PlayerHost } from '../host.js';
import { MenuElement, single } from './menu-element.js';
import { show } from './shared.js';

/** The language, then the role, then the id: whichever the manifest gave. */
export function trackLabel(track: Track): string {
  const parts = [track.lang, track.role].filter((part) => part !== undefined);
  return parts.length === 0 ? track.id : parts.join(' · ');
}

/** The tracks of one content type as menu items, with the active one's id. */
export function trackItems(
  engine: Mattebox,
  contentType: ContentType,
): [Array<readonly [string, string]>, string | null] {
  const tracks = engine.tracks;
  const available = tracks.available.filter((track) => track.contentType === contentType);
  const items: Array<readonly [string, string]> = [];
  for (const track of available) items.push([track.id, trackLabel(track)]);
  return [items, tracks.active(contentType)?.id ?? null];
}

/** Subscribes `tick` to the track events, and answers the unsubscribe. */
export function onTracks(engine: Mattebox, tick: () => void): () => void {
  const offs = [engine.on('tracks:changed', tick), engine.on('tracks:selected', tick)];
  return () => {
    for (const off of offs) off();
  };
}

export class MbxAudioMenu extends MenuElement {
  static get observedAttributes(): readonly string[] {
    return ['label', 'label-back'];
  }

  declare private engine: Mattebox | null;

  constructor() {
    super(...single('music'));
    this.engine = null;
    show(this.slots, 'default');
  }

  protected override name(): string {
    return 'Audio';
  }

  protected override attach(player: PlayerHost): void {
    this.follow(player, (engine) => {
      this.engine = engine;
      this.render();
      if (engine === null) return undefined;
      return onTracks(engine, () => {
        this.render();
      });
    });
  }

  protected override render(): void {
    super.render();
    const engine = this.engine;
    if (engine === null) {
      this.hidden = true;
      return;
    }
    const [items, active] = trackItems(engine, 'audio');
    this.menu.fill([
      {
        name: 'track',
        items,
        value: active ?? '',
        onSelect: (value) => {
          engine.tracks.select(value);
          this.render();
        },
      },
    ]);
    this.hidden = items.length < 2;
  }
}
