/**
 * <mbx-cast-button>: starts and ends a Chromecast session for the player,
 * and is hidden where there is no Cast: a browser without the SDK, or no
 * device on the network. `receiver` is the receiver application id, the
 * Default Media Receiver without one; `sdk="none"` leaves loading the
 * sender SDK to the page. The glyph is `icon` or `icon-active`, the name
 * `label-start` or `label-stop`.
 *
 * Before the request goes to the receiver the button dispatches
 * `castload`, cancelable, with the request as `detail`, so a page adds
 * `customData` for its receiver or cancels. The player carries `casting`
 * while the session runs, and the cast screen drives the receiver.
 */
import type { Cast } from './cast.js';
import { cast } from './cast.js';
import { Component } from './component.js';
import type { PlayerHost } from './host.js';
import { icon } from './icons.js';
import { BUTTON_STYLE, iconSlots, show, style } from './shared.js';

type State = 'default' | 'active';
const STATES: readonly State[] = ['default', 'active'];

export class MbxCastButton extends Component {
  static get observedAttributes(): readonly string[] {
    return ['label-start', 'label-stop'];
  }

  declare private readonly button: HTMLButtonElement;
  declare private readonly slots: Record<State, HTMLSlotElement>;
  declare private api: Cast | null;

  constructor() {
    super();
    this.api = null;
    const root = this.attachShadow({ mode: 'open' });
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.setAttribute('part', 'button');
    this.slots = iconSlots(STATES, (state) => icon(state === 'active' ? 'cast-active' : 'cast'));
    for (const state of STATES) this.button.append(this.slots[state]);
    this.button.addEventListener('click', () => {
      const api = this.api;
      if (api === null) return;
      if (api.state() === 'casting') api.stop();
      else api.start(this);
    });
    root.append(style(BUTTON_STYLE), this.button);
  }

  protected override attach(player: PlayerHost): void {
    const api = cast(player);
    this.api = api;
    api.connect(this.getAttribute('receiver'), this.getAttribute('sdk'));
    this.keep(
      api.watch(() => {
        this.render();
      }),
    );
    // A session decides whether there is anything to send.
    this.follow(player, () => {
      this.render();
      return undefined;
    });
  }

  protected override detach(): void {
    this.api?.disconnect();
    this.api = null;
  }

  protected override render(): void {
    const player = this.player;
    const api = this.api;
    if (player === null || api === null) return;
    const state = api.state();
    const active = state === 'casting';
    this.hidden = state === 'unavailable';
    // Nothing loaded means nothing to send; the receiver would show its idle screen.
    this.button.disabled = !active && player.player?.session == null;
    this.button.toggleAttribute('aria-busy', state === 'connecting');
    show(this.slots, active ? 'active' : 'default');
    this.button.setAttribute(
      'aria-label',
      active
        ? (this.getAttribute('label-stop') ?? 'Stop casting')
        : (this.getAttribute('label-start') ?? 'Cast'),
    );
  }
}
