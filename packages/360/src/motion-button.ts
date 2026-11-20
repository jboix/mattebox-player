/**
 * <mbx-motion-button>: lets the viewer turn the device's motion on or off
 * for the player's 360° view, for a viewer who wants to look around by
 * touch only. It is a toggle: one name, `label`, and `aria-pressed` for
 * the state. The glyph is `icon-on` or `icon-off`.
 *
 * It is hidden where it does nothing: no `<mbx-360>` view showing, or a
 * device without motion sensors, such as a computer. The choice lasts as
 * long as the element; the page's `motion` attribute replaces it.
 *
 * The player exports no base class, so the button finds its player and
 * lets go of it the way `<mbx-360>` does (player guide, chapter 03).
 *
 * No class fields: the ES2015 build would lower them into helpers, and the
 * emit check bans helpers. State is declared, then assigned in the
 * constructor.
 */
import type { PlayerHost } from '@mattebox/player';
import BUTTON_CSS from './button.css?inline';
import type { Mbx360 } from './element.js';
import type { Shape } from './glyph.js';
import { glyph } from './glyph.js';
import { findPlayer, PLAYER } from './host.js';
import type {} from './messages.js';

/** A phone, its screen cut out: a filled path on a 32-unit viewBox. */
const PHONE: Shape = {
  d: 'M13 5H19A2.5 2.5 0 0 1 21.5 7.5V24.5A2.5 2.5 0 0 1 19 27H13A2.5 2.5 0 0 1 10.5 24.5V7.5A2.5 2.5 0 0 1 13 5zM12.5 8V23H19.5V8z',
};

/** Two arcs either side of the phone: it turns. */
const TURNS: Shape = { d: 'M6.5 11A8 8 0 0 0 6.5 21M25.5 11A8 8 0 0 1 25.5 21', line: true };

/** A stroke across the glyph: motion is off. */
const STRUCK: Shape = { d: 'M5 5L27 27', line: true };

export class MbxMotionButton extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['label'];
  }

  declare private player: PlayerHost | null;
  declare private offs: Array<() => void>;
  /** Bumped on every connect and disconnect, so a late upgrade attaches only to the current connection. */
  declare private epoch: number;
  declare private readonly button: HTMLButtonElement;
  declare private readonly on: HTMLSlotElement;
  declare private readonly off: HTMLSlotElement;

  constructor() {
    super();
    this.player = null;
    this.offs = [];
    this.epoch = 0;
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = BUTTON_CSS;
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.setAttribute('part', 'button');
    this.on = glyph('icon-on', [PHONE, TURNS]);
    this.off = glyph('icon-off', [PHONE, STRUCK]);
    this.button.append(this.on, this.off);
    this.button.addEventListener('click', () => {
      const view = this.view();
      // From the click itself: iOS asks for the permission only during one.
      view?.setMotion(!view.motionOn);
    });
    root.append(style, this.button);
  }

  connectedCallback(): void {
    // Hidden until a view and its sensors are there. Not in the
    // constructor, which may not set attributes.
    this.hidden = true;
    const found = findPlayer(this);
    if (found === null) return;
    this.epoch += 1;
    const epoch = this.epoch;
    const attach = (): void => {
      if (epoch !== this.epoch || !this.isConnected) return;
      customElements.upgrade(found);
      if (!('media' in found)) return;
      this.player = found as PlayerHost;
      this.attach(this.player);
    };
    if ('media' in found) attach();
    else void customElements.whenDefined(PLAYER).then(attach);
  }

  disconnectedCallback(): void {
    this.epoch += 1;
    for (const off of this.offs) off();
    this.offs = [];
    this.player = null;
  }

  attributeChangedCallback(): void {
    this.render();
  }

  private attach(player: PlayerHost): void {
    const render = (): void => this.render();
    // `motionchange` bubbles from <mbx-360> to the player.
    for (const type of ['localechange', 'motionchange']) {
      player.addEventListener(type, render);
      this.offs.push(() => player.removeEventListener(type, render));
    }
    // The view shows (`active`) on <mbx-360>, below the player.
    const watch = new MutationObserver(render);
    watch.observe(player, {
      attributes: true,
      attributeFilter: ['active'],
      subtree: true,
      childList: true,
    });
    this.offs.push(() => watch.disconnect());
    this.render();
  }

  /** The player's `<mbx-360>`, or null. */
  private view(): Mbx360 | null {
    return this.player?.querySelector<Mbx360>('mbx-360') ?? null;
  }

  private render(): void {
    if (this.player === null) return;
    const view = this.view();
    const on = view?.motionOn === true;
    this.hidden = view === null || !view.hasAttribute('active') || !view.motionAvailable;
    this.on.hidden = !on;
    this.off.hidden = on;
    this.button.setAttribute('aria-pressed', String(on));
    this.button.setAttribute(
      'aria-label',
      this.getAttribute('label') ?? this.player.message('deviceMotion') ?? 'Turn with the device',
    );
  }
}
