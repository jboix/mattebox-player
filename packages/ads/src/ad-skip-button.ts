/**
 * <mbx-ad-skip-button>: "Skip in 5" while the ad may not be skipped yet,
 * then "Skip ad" or "Skip promo", at the bottom right above the bar. Hidden
 * for an ad that cannot be skipped. A break the stream plays with the
 * controls kept skips at once, to its end. `label`, `label-promo` and
 * `label-wait` replace the words.
 */

import { Component } from './component.js';
import type { Controller } from './controller.js';
import { controllerFor } from './controller.js';
import type { PlayerHost } from './host.js';
import { fill, style } from './shared.js';

const SVG = 'http://www.w3.org/2000/svg';

export class MbxAdSkipButton extends Component {
  static get observedAttributes(): readonly string[] {
    return ['label', 'label-promo', 'label-wait'];
  }

  declare private readonly button: HTMLButtonElement;
  declare private readonly text: HTMLSpanElement;
  declare private readonly chevron: SVGSVGElement;
  declare private ads: Controller | null;

  constructor() {
    super();
    this.ads = null;
    const root = this.attachShadow({ mode: 'open' });
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.setAttribute('part', 'button');
    this.text = document.createElement('span');
    this.chevron = document.createElementNS(SVG, 'svg');
    this.chevron.setAttribute('viewBox', '0 0 32 32');
    this.chevron.setAttribute('aria-hidden', 'true');
    this.chevron.setAttribute('part', 'chevron');
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', 'M12 8l8 8l-8 8');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    this.chevron.append(path);
    this.button.append(this.text, this.chevron);
    this.button.addEventListener('click', () => this.ads?.skip());
    root.append(style('right:1em;bottom:calc(var(--mbx-bar-rows, 6.5em) + 0.75em)'), this.button);
  }

  protected override attach(player: PlayerHost): void {
    this.ads = controllerFor(player);
    this.keep(this.ads.watch(() => this.render()));
    this.render();
  }

  protected override detach(): void {
    this.ads = null;
  }

  protected override render(): void {
    const state = this.ads?.state ?? null;
    const skipIn = state?.skipIn ?? null;
    this.hidden = state === null || skipIn === null;
    if (state === null || skipIn === null) return;
    const waiting = skipIn > 0;
    this.button.disabled = waiting;
    this.chevron.toggleAttribute('hidden', waiting);
    this.text.textContent = waiting
      ? fill(this.word('label-wait', 'adSkipIn', 'Skip in {seconds}'), {
          seconds: Math.ceil(skipIn),
        })
      : state.role === 'promo'
        ? this.word('label-promo', 'adSkipPromo', 'Skip promo')
        : this.word('label', 'adSkip', 'Skip ad');
  }
}
