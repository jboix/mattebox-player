/**
 * What every control shares: finding its player, and letting go of it.
 *
 * A control attaches when it is connected inside a player, once the player
 * is defined and upgraded, and detaches when it is removed. Every listener
 * a control adds goes through `listen`, so detaching drops them all. A
 * control connected outside a player is inert. Moving one to another
 * player detaches and attaches again, so a framework that reorders
 * children is safe.
 *
 * No class fields: the ES2015 build would lower them into helpers, and the
 * emit check bans helpers. State is declared, then assigned in the
 * constructor.
 */
import type { Mattebox } from 'mattebox';
import type { PlayerHost } from '../host.js';
import { findPlayer } from '../host.js';
import type { Messages } from '../messages.js';
import { PLAYER } from '../tags.js';
import type { Text } from '../text.js';
import { textIn } from '../text.js';

export abstract class Component extends HTMLElement {
  declare protected player: PlayerHost | null;
  /**
   * When the control has nothing to act on while a device plays in the
   * video's place: `device` for any device, since the control acts on the
   * picture of the page or on its quality, and `remote` for a device that
   * is not the video itself, as AirPlay is. The control then carries
   * `away`, and its stylesheet hides it. Null for a control that stays.
   */
  declare protected leaves: 'device' | 'remote' | null;
  declare private offs: Array<() => void>;
  /** Bumped on every connect and disconnect, so a late upgrade attaches only to the current connection. */
  declare private epoch: number;

  constructor() {
    super();
    this.player = null;
    this.leaves = null;
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
      // Defined, and this instance upgraded: `media` is on the prototype.
      customElements.upgrade(found);
      if (!('media' in found)) return;
      this.player = found as PlayerHost;
      // The player's size tier, on the control itself: a shadow tree cannot
      // match an attribute of an ancestor in every browser, and with it
      // here a control's stylesheet says `:host([layout="compact"])`.
      const tier = (): void => {
        const layout = found.getAttribute('layout');
        if (layout === null) this.removeAttribute('layout');
        else this.setAttribute('layout', layout);
      };
      this.listen(found, ['layoutchange'], () => {
        tier();
        this.render();
      });
      this.listen(found, ['localechange'], () => {
        this.render();
      });
      const cast = (): void => {
        const gone =
          this.leaves !== null &&
          found.hasAttribute('casting') &&
          (this.leaves === 'device' || this.remote());
        this.toggleAttribute('away', gone);
      };
      this.listen(found, ['castingchange'], () => {
        cast();
        this.render();
      });
      tier();
      cast();
      this.attach(this.player);
    };
    if ('media' in found) attach();
    else void customElements.whenDefined(PLAYER).then(attach);
  }

  disconnectedCallback(): void {
    this.epoch += 1;
    for (const off of this.offs) off();
    this.offs = [];
    const player = this.player;
    if (player === null) return;
    this.player = null;
    this.detach(player);
  }

  attributeChangedCallback(): void {
    if (this.player !== null) this.render();
  }

  /** Adds `fn` for every name on `target`, to be removed on detach. */
  protected listen(
    target: EventTarget,
    names: readonly string[],
    fn: (event: Event) => void,
  ): void {
    for (const name of names) target.addEventListener(name, fn);
    this.offs.push(() => {
      for (const name of names) target.removeEventListener(name, fn);
    });
  }

  /**
   * Whether a device plays that is not the video itself. Under AirPlay the
   * video still plays the source and answers every member.
   */
  protected remote(): boolean {
    const target = this.player?.casting ?? null;
    return target !== null && target.kind !== 'airplay';
  }

  /**
   * A word the control shows: its `attribute` when the page set one, else
   * the player's language's `id`, else `english`.
   */
  protected word(attribute: string, id: keyof Messages, english: string): string {
    return this.getAttribute(attribute) ?? this.player?.message(id) ?? english;
  }

  /** Words the page gave, in the player's language. */
  protected pageText(text: Text): string {
    return textIn(text, this.player?.locale ?? '');
  }

  /** Keeps `off` to run on detach. */
  protected keep(off: () => void): void {
    this.offs.push(off);
  }

  /**
   * Runs `fn` over the current engine now and on every session change,
   * running what the last call returned first, so a control's engine
   * subscriptions live exactly as long as the session. Detach runs it too.
   */
  protected follow(
    player: PlayerHost,
    fn: (engine: Mattebox | null) => (() => void) | undefined,
  ): void {
    let off: (() => void) | undefined;
    const run = (): void => {
      off?.();
      off = fn(player.engine);
    };
    this.listen(player, ['sourcechange'], run);
    this.offs.push(() => {
      off?.();
      off = undefined;
    });
    run();
  }

  /** Runs `fn` when any of `names` changes on `target`, or under it with `subtree`, until detach. */
  protected observe(
    target: Element,
    names: readonly string[],
    fn: () => void,
    subtree = false,
  ): void {
    const observer = new MutationObserver(fn);
    observer.observe(target, { attributes: true, attributeFilter: [...names], subtree });
    this.offs.push(() => {
      observer.disconnect();
    });
  }

  /** The control is connected inside an upgraded player. Subscribe and render. */
  protected abstract attach(player: PlayerHost): void;

  /** The control left its player. Listeners are already gone; undo anything else. */
  protected detach(_player: PlayerHost): void {}

  /** Draws the current state. Called on every observed attribute change while attached. */
  protected render(): void {}
}
