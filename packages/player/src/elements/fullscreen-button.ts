/**
 * <mbx-fullscreen-button>: fullscreen on the player, through whichever
 * API the browser has, and hidden where there is none. The glyph is
 * `icon-enter` or `icon-exit`, the name `label-enter` or `label-exit`,
 * and the element sets `fullscreen` on the player while it is in.
 */

import type { Fullscreen } from '../controls/fullscreen.js';
import { fullscreen } from '../controls/fullscreen.js';
import { icon } from '../controls/icons.js';
import type { PlayerHost } from '../host.js';
import { Component } from './component.js';
import { BUTTON_STYLE, iconSlots, show, style } from './shared.js';

type State = 'enter' | 'exit';
const STATES: readonly State[] = ['enter', 'exit'];

export class MbxFullscreenButton extends Component {
  static get observedAttributes(): readonly string[] {
    return ['label-enter', 'label-exit'];
  }

  declare private readonly button: HTMLButtonElement;
  declare private readonly slots: Record<State, HTMLSlotElement>;
  declare private api: Fullscreen | null;

  constructor() {
    super();
    this.api = null;
    const root = this.attachShadow({ mode: 'open' });
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.setAttribute('part', 'button');
    this.slots = iconSlots(STATES, (state) =>
      icon(state === 'enter' ? 'fullscreen' : 'fullscreen-exit'),
    );
    for (const state of STATES) this.button.append(this.slots[state]);
    this.button.addEventListener('click', () => {
      this.api?.toggle();
    });
    root.append(style(BUTTON_STYLE), this.button);
  }

  protected override attach(player: PlayerHost): void {
    const api = fullscreen(player, player.video);
    this.api = api;
    this.hidden = !api.supported;
    this.keep(
      api.watch(() => {
        this.render();
      }),
    );
    this.render();
  }

  protected override detach(): void {
    this.api = null;
  }

  protected override render(): void {
    const player = this.player;
    if (player === null || this.api === null) return;
    const active = this.api.active();
    show(this.slots, active ? 'exit' : 'enter');
    this.button.setAttribute(
      'aria-label',
      active
        ? (this.getAttribute('label-exit') ?? 'Exit fullscreen')
        : (this.getAttribute('label-enter') ?? 'Enter fullscreen'),
    );
    player.toggleAttribute('fullscreen', active);
  }
}
