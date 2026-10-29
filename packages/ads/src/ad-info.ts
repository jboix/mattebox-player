/**
 * <mbx-ad-info>: "Ad" or "Promo", or "Ad 2 of 3", and the time left in the
 * break, at the top left while an ad plays. For a break the stream plays
 * with the controls kept, a line under it shows how far it has played,
 * since the seek bar still shows the programme. A screen reader hears "Ad
 * break, 30 seconds" when a break starts. `label`, `label-count`,
 * `label-promo`, `label-promo-count` and `label-break` replace the words.
 */

import { Component } from './component.js';
import type { Controller } from './controller.js';
import { controllerFor } from './controller.js';
import type { PlayerHost } from './host.js';
import { clock, fill, style } from './shared.js';

export class MbxAdInfo extends Component {
  static get observedAttributes(): readonly string[] {
    return ['label', 'label-count', 'label-promo', 'label-promo-count', 'label-break'];
  }

  declare private readonly label: HTMLSpanElement;
  declare private readonly time: HTMLSpanElement;
  declare private readonly line: HTMLDivElement;
  declare private readonly lineFill: HTMLDivElement;
  declare private readonly live: HTMLSpanElement;
  declare private ads: Controller | null;
  declare private told: string | null;

  constructor() {
    super();
    this.ads = null;
    this.told = null;
    const root = this.attachShadow({ mode: 'open' });
    const panel = document.createElement('div');
    panel.setAttribute('part', 'panel');
    const row = document.createElement('div');
    row.setAttribute('part', 'row');
    this.label = document.createElement('span');
    this.label.setAttribute('part', 'label');
    this.time = document.createElement('span');
    this.time.setAttribute('part', 'time');
    row.append(this.label, this.time);
    this.line = document.createElement('div');
    this.line.setAttribute('part', 'line');
    this.lineFill = document.createElement('div');
    this.lineFill.setAttribute('part', 'line-fill');
    this.line.append(this.lineFill);
    panel.append(row, this.line);
    this.live = document.createElement('span');
    this.live.setAttribute('part', 'live');
    this.live.setAttribute('role', 'status');
    root.append(style('top:0.875em;left:1em'), panel, this.live);
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
    this.hidden = state === null;
    if (state === null) {
      this.told = null;
      return;
    }
    const promo = state.role === 'promo';
    this.label.textContent =
      state.total > 1
        ? fill(
            promo
              ? this.word('label-promo-count', 'adPromoCount', 'Promo {index} of {total}')
              : this.word('label-count', 'adCount', 'Ad {index} of {total}'),
            { index: state.index, total: state.total },
          )
        : promo
          ? this.word('label-promo', 'adPromo', 'Promo')
          : this.word('label', 'adLabel', 'Ad');
    this.time.textContent = Number.isFinite(state.remaining) ? `· ${clock(state.remaining)}` : '';
    this.line.hidden = !state.free;
    const share =
      Number.isFinite(state.duration) && state.duration > 0
        ? Math.min(1, Math.max(0, state.currentTime / state.duration))
        : 0;
    this.lineFill.style.width = `${(share * 100).toFixed(2)}%`;
    if (this.told !== state.breakId && Number.isFinite(state.remaining)) {
      this.told = state.breakId;
      this.live.textContent = fill(
        this.word('label-break', 'adBreak', 'Ad break, {seconds} seconds'),
        {
          seconds: Math.ceil(state.remaining),
        },
      );
    }
  }
}
