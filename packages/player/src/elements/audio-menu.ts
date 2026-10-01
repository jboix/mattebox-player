/**
 * <mbx-audio-menu>: the audio track over `engine.tracks`. Hidden unless
 * there is a choice to make, and for a native session. The name comes
 * from `label`. A track reads as its language, then its role, then its
 * id: whichever the manifest gave. A badge marks an audio description
 * track (`label-ad`, "AD") and the original language (`label-original`,
 * "Original"), from the engine's standard characteristics (guide chapter 06).
 */
import type { ContentType, Mattebox, Track } from 'mattebox';
import { isAudioDescription, isOriginal } from 'mattebox';
import type { MenuGroup } from '../controls/menu.js';
import type { PlayerHost } from '../host.js';
import { MenuElement, single } from './menu-element.js';
import { show } from './shared.js';

/** The language, then the role, then the id: whichever the manifest gave. */
export function trackLabel(track: Track): string {
  const parts = [track.lang, track.role].filter((part) => part !== undefined);
  return parts.length === 0 ? track.id : parts.join(' · ');
}

/**
 * The tracks of one content type that the engine can play and `listed`
 * keeps, as menu items with their badges, and the active one's id when it
 * is listed. A track the browser cannot decode, or that no stage plays,
 * stays out (guide chapter 06).
 */
export function trackItems(
  engine: Mattebox,
  contentType: ContentType,
  badges: (track: Track) => readonly string[] = () => [],
  listed: (track: Track) => boolean = () => true,
): [MenuGroup['items'], string | null] {
  const tracks = engine.tracks;
  const available = tracks.available.filter(
    (track) => track.contentType === contentType && tracks.selectable(track.id) && listed(track),
  );
  const items = available.map(
    (track) => [track.id, trackLabel(track), undefined, undefined, badges(track)] as const,
  );
  const active = tracks.active(contentType)?.id;
  return [items, available.some((track) => track.id === active) ? (active as string) : null];
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
    return ['label', 'label-back', 'label-ad', 'label-original'];
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
    const [items, active] = trackItems(engine, 'audio', (track) => [
      ...(isAudioDescription(track) ? [this.getAttribute('label-ad') ?? 'AD'] : []),
      ...(isOriginal(track) ? [this.getAttribute('label-original') ?? 'Original'] : []),
    ]);
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
