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
import type { Messages } from '../messages.js';
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
      picture: () => this.player?.video.getBoundingClientRect() ?? null,
      frame: () => this.player,
      back: (page) => fill(this.word('label-back', 'menuBack', 'Back from {page}'), { page }),
    });
    this.slots = iconSlots(states, glyphs);
    for (const state of states) this.menu.button.append(this.slots[state]);
    root.append(style(MENU_STYLE), this.menu.button, this.menu.backdrop, this.menu.popup);
  }

  /** The id and the English of the button's default name. */
  protected abstract name(): readonly [keyof Messages, string];

  protected override detach(): void {
    this.menu.close();
  }

  protected override render(): void {
    this.menu.label(this.word('label', ...this.name()));
  }
}

/** A glyph that never changes, for a menu of one state. */
export function single(name: IconName): [readonly ['default'], () => SVGSVGElement] {
  return [['default'], () => icon(name)];
}
