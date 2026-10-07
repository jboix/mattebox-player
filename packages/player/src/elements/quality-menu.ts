/**
 * <mbx-quality-menu>: the pin over `engine.quality`, where "auto" means
 * none. Hidden without renditions, and for a native session. The name
 * comes from `label`, the word for no pin from `label-auto`. It offers
 * `engine.quality.selectable`, labelled by `qualityNames`.
 */
import type { Mattebox } from 'mattebox';
import { qualityNames } from '../controls/quality-names.js';
import type { PlayerHost } from '../host.js';
import { MenuElement, single } from './menu-element.js';
import { show } from './shared.js';

const AUTO = 'auto';

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
    items.push(...qualityNames(quality.selectable));
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
}
