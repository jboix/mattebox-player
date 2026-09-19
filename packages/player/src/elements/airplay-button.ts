/**
 * <mbx-airplay-button>: opens Safari's AirPlay picker for the video, and
 * is hidden where there is no AirPlay. The glyph is `icon` or
 * `icon-active`, the name `label` or `label-active`, and the element sets
 * `airplay` on the player while the video plays on a target.
 *
 * It is also hidden while the element cannot offer a target, which is what
 * an engine session without an AirPlay source alternative leaves behind.
 * Nothing announces that, so it is read again on every source change.
 */
import type { Airplay } from '../controls/airplay.js';
import { airplay } from '../controls/airplay.js';
import { icon } from '../controls/icons.js';
import type { PlayerHost } from '../host.js';
import { Component } from './component.js';
import { BUTTON_STYLE, iconSlots, show, style } from './shared.js';

type State = 'default' | 'active';
const STATES: readonly State[] = ['default', 'active'];

export class MbxAirplayButton extends Component {
  static get observedAttributes(): readonly string[] {
    return ['label', 'label-active'];
  }

  declare private readonly button: HTMLButtonElement;
  declare private readonly slots: Record<State, HTMLSlotElement>;
  declare private api: Airplay | null;

  constructor() {
    super();
    this.api = null;
    const root = this.attachShadow({ mode: 'open' });
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.setAttribute('part', 'button');
    this.slots = iconSlots(STATES, (state) =>
      icon(state === 'active' ? 'airplay-active' : 'airplay'),
    );
    for (const state of STATES) this.button.append(this.slots[state]);
    this.button.addEventListener('click', () => {
      this.api?.show();
    });
    root.append(style(BUTTON_STYLE), this.button);
  }

  protected override attach(player: PlayerHost): void {
    const api = airplay(player.video);
    this.api = api;
    this.keep(
      api.watch(() => {
        this.render();
      }),
    );
    // A new session decides whether the element can offer a target at all.
    this.follow(player, () => {
      this.render();
      return undefined;
    });
  }

  protected override detach(player: PlayerHost): void {
    this.api = null;
    player.removeAttribute('airplay');
  }

  protected override render(): void {
    const player = this.player;
    if (player === null || this.api === null) return;
    const active = this.api.active();
    this.hidden = !this.api.supported || !this.api.offered();
    show(this.slots, active ? 'active' : 'default');
    this.button.setAttribute(
      'aria-label',
      active
        ? (this.getAttribute('label-active') ?? 'Stop AirPlay')
        : (this.getAttribute('label') ?? 'AirPlay'),
    );
    player.toggleAttribute('airplay', active);
  }
}
