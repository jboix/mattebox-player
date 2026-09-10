/**
 * What the menus share: the primitive in the shadow root, the glyph slots
 * on its button, the name from `label`, the Back item's name from
 * `label-back`, and the popup fitted under the top of the picture. A
 * subclass fills the entries in `render()`, which runs on attach, on every
 * observed attribute, and whenever it asks.
 */
import type { IconName } from '../controls/icons.js';
import { icon } from '../controls/icons.js';
import type { Menu } from '../controls/menu.js';
import { menu } from '../controls/menu.js';
import { fill } from '../labels.js';
import { Component } from './component.js';
import { iconSlots, MENU_STYLE, style } from './shared.js';

export abstract class MenuElement<S extends string = 'default'> extends Component {
  declare protected readonly menu: Menu;
  declare protected readonly slots: Record<S, HTMLSlotElement>;

  constructor(states: readonly S[], glyphs: (state: S) => SVGSVGElement) {
    super();
    const root = this.attachShadow({ mode: 'open' });
    this.menu = menu({
      host: this,
      ceiling: () => this.player?.video.getBoundingClientRect().top ?? null,
      back: (page) => fill(this.getAttribute('label-back') ?? 'Back from {page}', { page }),
    });
    this.slots = iconSlots(states, glyphs);
    for (const state of states) this.menu.button.append(this.slots[state]);
    root.append(style(MENU_STYLE), this.menu.button, this.menu.popup);
  }

  /** The default name of the button. */
  protected abstract name(): string;

  protected override detach(): void {
    this.menu.close();
  }

  protected override render(): void {
    this.menu.label(this.getAttribute('label') ?? this.name());
  }
}

/** A glyph that never changes, for a menu of one state. */
export function single(name: IconName): [readonly ['default'], () => SVGSVGElement] {
  return [['default'], () => icon(name)];
}
