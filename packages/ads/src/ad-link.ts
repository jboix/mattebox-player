/**
 * <mbx-ad-link>: an info button at the top right while an ad with a page of
 * its own plays, named "Learn more" for a screen reader and in its tooltip.
 * It opens the page in a new tab, pauses the ad, and reports the click.
 * `label` replaces the words; a page's own SVG in `slot="icon"` replaces the
 * glyph.
 */

import { Component } from './component.js';
import type { Controller } from './controller.js';
import { controllerFor } from './controller.js';
import type { PlayerHost } from './host.js';
import { style } from './shared.js';

export class MbxAdLink extends Component {
  static get observedAttributes(): readonly string[] {
    return ['label'];
  }

  declare private readonly button: HTMLButtonElement;
  declare private ads: Controller | null;

  constructor() {
    super();
    this.ads = null;
    const root = this.attachShadow({ mode: 'open' });
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.setAttribute('part', 'icon-button');
    // A circle with an i: drawn even-odd on the player's 32-unit grid.
    const glyph = document.createElement('slot');
    glyph.name = 'icon';
    glyph.innerHTML =
      '<svg part="icon" viewBox="0 0 32 32" aria-hidden="true"><path fill-rule="evenodd" d="M16 3a13 13 0 1 1 0 26a13 13 0 1 1 0-26zM16 5.5a10.5 10.5 0 1 0 0 21a10.5 10.5 0 1 0 0-21zM14.5 14h3v9h-3zM14.5 9h3v3h-3z"/></svg>';
    const disc = document.createElement('span');
    disc.setAttribute('part', 'disc');
    disc.append(glyph);
    this.button.append(disc);
    this.button.addEventListener('click', () => this.ads?.click());
    root.append(style('top:0.5em;right:0.75em'), this.button);
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
    this.hidden = state?.clickThrough === undefined;
    const label = this.word('label', 'adLearnMore', 'Learn more');
    this.button.setAttribute('aria-label', label);
    this.button.title = label;
  }
}
