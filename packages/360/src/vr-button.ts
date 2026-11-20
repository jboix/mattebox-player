/**
 * <mbx-vr-button>: shows the player's 360° view in a WebXR headset, and
 * ends it. It is hidden where no headset can show it: a browser without
 * WebXR, no headset, or no `<mbx-360>` view showing in the player. The
 * glyph is `icon-enter` or `icon-exit`, the name `label-enter` or
 * `label-exit`.
 *
 * The player exports no base class, so the button finds its player and
 * lets go of it the way `<mbx-360>` does (player guide, chapter 03).
 *
 * No class fields: the ES2015 build would lower them into helpers, and the
 * emit check bans helpers. State is declared, then assigned in the
 * constructor.
 */
import type { Messages, PlayerHost } from '@mattebox/player';
import BUTTON_CSS from './button.css?inline';
import type { Mbx360 } from './element.js';
import { findPlayer, PLAYER } from './host.js';
import type {} from './messages.js';
import { headsets, webxr } from './xr.js';

const SVG = 'http://www.w3.org/2000/svg';

/** A headset seen from the front, its two lenses cut out: a filled path on a 32-unit viewBox. */
const HEADSET =
  'M5 9H27A3 3 0 0 1 30 12V21A3 3 0 0 1 27 24H20.5L18 20H14L11.5 24H5A3 3 0 0 1 2 21V12A3 3 0 0 1 5 9zM10 13.5A3 3 0 1 0 10 19.5A3 3 0 1 0 10 13.5zM22 13.5A3 3 0 1 0 22 19.5A3 3 0 1 0 22 13.5z';

/** A slot named `icon-<state>` with the headset glyph as its fallback, so a page drops its own SVG in. */
function slot(state: 'enter' | 'exit'): HTMLSlotElement {
  const node = document.createElement('slot');
  node.name = `icon-${state}`;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('part', 'icon');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('fill-rule', 'evenodd');
  path.setAttribute('d', HEADSET);
  svg.append(path);
  node.append(svg);
  return node;
}

export class MbxVrButton extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['label-enter', 'label-exit'];
  }

  declare private player: PlayerHost | null;
  declare private offs: Array<() => void>;
  /** Bumped on every connect and disconnect, so a late upgrade attaches only to the current connection. */
  declare private epoch: number;
  declare private readonly button: HTMLButtonElement;
  declare private readonly enter: HTMLSlotElement;
  declare private readonly exit: HTMLSlotElement;
  /** A headset can show an immersive session, as the browser last said. */
  declare private supported: boolean;

  constructor() {
    super();
    this.player = null;
    this.offs = [];
    this.epoch = 0;
    this.supported = false;
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = BUTTON_CSS;
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.setAttribute('part', 'button');
    this.enter = slot('enter');
    this.exit = slot('exit');
    this.button.append(this.enter, this.exit);
    this.button.addEventListener('click', () => {
      const view = this.view();
      if (view === null) return;
      // A refusal leaves the screen view as it was; there is nothing to tell.
      (view.immersive ? view.exitVR() : view.enterVR()).catch(() => undefined);
    });
    root.append(style, this.button);
  }

  connectedCallback(): void {
    // Hidden until the browser says a headset is there. Not in the
    // constructor, which may not set attributes.
    this.hidden = !this.supported;
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
    player.addEventListener('localechange', render);
    this.offs.push(() => player.removeEventListener('localechange', render));
    // The view shows (`active`) and enters a headset (`vr`) on <mbx-360>, below the player.
    const watch = new MutationObserver(render);
    watch.observe(player, {
      attributes: true,
      attributeFilter: ['active', 'vr'],
      subtree: true,
      childList: true,
    });
    this.offs.push(() => watch.disconnect());
    // A headset plugged in or out (WebXR's `devicechange`) changes the answer.
    const xr = webxr()?.xr;
    const ask = (): void => {
      void headsets().then((supported) => {
        this.supported = supported;
        this.render();
      });
    };
    if (xr !== undefined) {
      xr.addEventListener('devicechange', ask);
      this.offs.push(() => xr.removeEventListener('devicechange', ask));
    }
    ask();
  }

  /** The player's `<mbx-360>`, or null. */
  private view(): Mbx360 | null {
    return this.player?.querySelector<Mbx360>('mbx-360') ?? null;
  }

  /** A word: the `attribute` the page set, else the player's language's `id`, else `english`. */
  private word(attribute: string, id: keyof Messages, english: string): string {
    return this.getAttribute(attribute) ?? this.player?.message(id) ?? english;
  }

  private render(): void {
    if (this.player === null) return;
    const view = this.view();
    const inside = view?.immersive === true;
    this.hidden = !this.supported || view === null || !view.hasAttribute('active');
    this.enter.hidden = inside;
    this.exit.hidden = !inside;
    this.button.setAttribute(
      'aria-label',
      inside
        ? this.word('label-exit', 'exitVr', 'Exit VR')
        : this.word('label-enter', 'enterVr', 'Enter VR'),
    );
  }
}
