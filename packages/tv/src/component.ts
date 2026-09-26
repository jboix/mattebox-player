/**
 * Finding the player, and letting go of it: the part of the player's own
 * control base this package needs. The player exports no base class, so a
 * control of the page's own, this one included, implements the contract
 * from outside (player guide, chapter 03).
 *
 * The control attaches when it is connected inside a player, once the
 * player is defined and upgraded, and detaches when it is removed. What it
 * adds goes through `keep`, so detaching drops it all.
 *
 * No class fields: the ES2015 build would lower them into helpers, and the
 * emit check bans helpers. State is declared, then assigned in the
 * constructor.
 */
import type { PlayerHost } from './host.js';
import { findPlayer, PLAYER } from './host.js';

export abstract class Component extends HTMLElement {
  declare protected player: PlayerHost | null;
  declare private offs: Array<() => void>;
  /** Bumped on every connect and disconnect, so a late upgrade attaches only to the current connection. */
  declare private epoch: number;

  constructor() {
    super();
    this.player = null;
    this.offs = [];
    this.epoch = 0;
  }

  connectedCallback(): void {
    const found = findPlayer(this);
    if (found === null) return;
    this.epoch += 1;
    const epoch = this.epoch;
    const attach = (): void => {
      if (epoch !== this.epoch || !this.isConnected) return;
      // Defined, and this instance upgraded: `video` is on the prototype.
      customElements.upgrade(found);
      if (!('video' in found)) return;
      this.player = found as PlayerHost;
      this.attach(this.player);
    };
    if ('video' in found) attach();
    else void customElements.whenDefined(PLAYER).then(attach);
  }

  disconnectedCallback(): void {
    this.epoch += 1;
    for (const off of this.offs) off();
    this.offs = [];
    this.player = null;
  }

  /** Adds `fn` for `name` on `target`, removed on detach. */
  protected on(
    target: EventTarget,
    name: string,
    fn: (event: Event) => void,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(name, fn, options);
    this.offs.push(() => {
      target.removeEventListener(name, fn, options);
    });
  }

  /** The control is connected inside an upgraded player. Subscribe. */
  protected abstract attach(player: PlayerHost): void;
}
