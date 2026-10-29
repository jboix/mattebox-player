/**
 * <mbx-ad-progress>: how far the ad has played, as a bar in the seek bar's
 * place while an ad plays, as YouTube shows it. Put it beside the seek bar,
 * in the bar's seek row; it is hidden outside ads, and the seek bar during
 * them.
 */

import { Component } from './component.js';
import type { Controller } from './controller.js';
import { controllerFor } from './controller.js';
import type { PlayerHost } from './host.js';
import PROGRESS_CSS from './progress.css?inline';

export class MbxAdProgress extends Component {
  declare private readonly fill: HTMLElement;
  declare private readonly rail: HTMLElement;
  declare private ads: Controller | null;

  constructor() {
    super();
    this.ads = null;
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = PROGRESS_CSS;
    this.rail = document.createElement('div');
    this.rail.setAttribute('part', 'rail');
    this.rail.setAttribute('role', 'progressbar');
    this.rail.setAttribute('aria-valuemin', '0');
    this.rail.setAttribute('aria-valuemax', '100');
    const track = document.createElement('div');
    track.setAttribute('part', 'track');
    this.fill = document.createElement('div');
    this.fill.setAttribute('part', 'fill');
    track.append(this.fill);
    this.rail.append(track);
    root.append(style, this.rail);
  }

  protected override attach(player: PlayerHost): void {
    // The bar's seek row, as the seek bar it stands in for.
    if (this.parentElement?.localName === 'mbx-control-bar' && !this.hasAttribute('slot')) {
      this.setAttribute('slot', 'seek');
    }
    this.ads = controllerFor(player);
    this.keep(this.ads.watch(() => this.render()));
    this.render();
  }

  protected override detach(): void {
    this.ads = null;
  }

  protected override render(): void {
    const state = this.ads?.state ?? null;
    // A break with the controls kept leaves the seek bar in place: its
    // label carries the progress instead.
    this.hidden = state === null || state.free;
    if (state === null) return;
    const share =
      Number.isFinite(state.duration) && state.duration > 0
        ? Math.min(1, Math.max(0, state.currentTime / state.duration))
        : 0;
    this.fill.style.width = `${(share * 100).toFixed(2)}%`;
    this.rail.setAttribute('aria-valuenow', String(Math.round(share * 100)));
  }
}
