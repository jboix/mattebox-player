/**
 * <mbx-quality-menu>: the pin over `engine.quality`, where "auto" means
 * none. Hidden without renditions, and for a native session. The name
 * comes from `label`, the word for no pin from `label-auto`. It offers
 * `engine.quality.selectable`, labelled by `qualityNames`. Under Auto, the
 * Auto row names what plays, in its detail.
 */
import type { Mattebox } from 'mattebox';
import { qualityLabels, qualityNames } from '../controls/quality-names.js';
import type { PlayerHost } from '../host.js';
import { MenuElement, single } from './menu-element.js';
import { show } from './shared.js';

const AUTO = 'auto';

export class MbxQualityMenu extends MenuElement {
  static get observedAttributes(): readonly string[] {
    return ['label', 'label-auto', 'label-back'];
  }

  declare private engine: Mattebox | null;
  /** The name of what plays, as the Auto row last showed it. */
  declare private playing: string | undefined;

  constructor() {
    super(...single('settings'));
    this.engine = null;
    this.playing = undefined;
    show(this.slots, 'default');
  }

  protected override name(): string {
    return 'Quality';
  }

  protected override attach(player: PlayerHost): void {
    this.follow(player, (engine) => {
      this.engine = engine;
      this.render();
      if (engine === null) return undefined;
      const tick = (): void => {
        this.render();
      };
      // What plays changes as the playhead reaches another rendition's
      // segments, and no event says so: read it on the clock, draw on a change.
      const clock = (): void => {
        if (this.playingName() !== this.playing) this.render();
      };
      player.video.addEventListener('timeupdate', clock);
      const offs = [
        () => player.video.removeEventListener('timeupdate', clock),
        engine.on('tracks:changed', tick),
        engine.on('quality:constraints-unsatisfiable', tick),
        engine.on('quality:pin-unsatisfiable', tick),
      ];
      return () => {
        for (const off of offs) off();
      };
    });
  }

  protected override render(): void {
    super.render();
    const engine = this.engine;
    if (engine === null) {
      this.hidden = true;
      return;
    }
    const quality = engine.quality;
    this.playing = this.playingName();
    const items: Array<readonly [string, string, (string | undefined)?]> = [
      [AUTO, this.getAttribute('label-auto') ?? 'Auto', this.playing],
      ...qualityNames(quality.selectable),
    ];
    this.menu.fill([
      {
        name: 'rendition',
        items,
        value: quality.pinned ?? AUTO,
        onSelect: (value) => {
          if (value === AUTO) quality.auto();
          else quality.pin(value);
          this.render();
        },
      },
    ]);
    this.hidden = items.length === 1;
  }

  /** The name of the rendition that plays, under Auto only: a pin names itself by its tick. */
  private playingName(): string | undefined {
    const quality = this.engine?.quality;
    if (quality === undefined || quality.pinned !== null) return undefined;
    // Every label, twins too: what plays may be a twin the menu shows once.
    const id = quality.playing?.id;
    return qualityLabels(quality.selectable).find(([candidate]) => candidate === id)?.[1];
  }
}
