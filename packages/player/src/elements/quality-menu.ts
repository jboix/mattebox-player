/**
 * <mbx-quality-menu>: the pin over `engine.quality`, where "auto" means
 * none. Hidden without renditions, and for a native session. The name
 * comes from `label`, the word for no pin from `label-auto`. A rendition
 * reads as its height when the manifest declared one, its bitrate
 * otherwise.
 */
import type { Mattebox, Rendition } from 'mattebox';
import type { PlayerHost } from '../host.js';
import { MenuElement, single } from './menu-element.js';
import { show } from './shared.js';

const AUTO = 'auto';

function renditionLabel(rendition: Rendition): string {
  if (rendition.height !== undefined) return `${rendition.height}p`;
  return `${Math.round(rendition.bitrate / 1000)} kbps`;
}

export class MbxQualityMenu extends MenuElement {
  static get observedAttributes(): readonly string[] {
    return ['label', 'label-auto', 'label-back'];
  }

  declare private engine: Mattebox | null;

  constructor() {
    super(...single('settings'));
    this.engine = null;
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
      const offs = [
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
    const items: Array<readonly [string, string]> = [
      [AUTO, this.getAttribute('label-auto') ?? 'Auto'],
    ];
    for (const rendition of quality.renditions) {
      items.push([rendition.id, renditionLabel(rendition)]);
    }
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
    this.hidden = quality.renditions.length === 0;
  }
}
