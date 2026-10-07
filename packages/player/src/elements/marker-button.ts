/**
 * <mbx-marker-button>: "Skip intro" over the picture while playback is in
 * the opening credits, "Skip credits" in the closing ones, and "Skip" with
 * the marker's own label in any other range the page named. A press moves
 * the playhead to the range's end. Blocked ranges never show it: the
 * player moves past those itself. The words come from
 * `label-opening-credits`, `label-closing-credits` and `label-skip`.
 */
import type { Marker } from '../controls/markers.js';
import type { PlayerHost } from '../host.js';
import { Component } from './component.js';
import STYLE_CSS from './marker-button.css?inline';
import { BUTTON_STYLE, style } from './shared.js';

const WORDS: Readonly<Record<string, string>> = {
  'opening-credits': 'Skip intro',
  'closing-credits': 'Skip credits',
};

export class MbxMarkerButton extends Component {
  static get observedAttributes(): readonly string[] {
    return ['label-opening-credits', 'label-closing-credits', 'label-skip'];
  }

  declare private readonly button: HTMLButtonElement;
  /** The range the button skips, or null while playback is in none. */
  declare private marker: Marker | null;
  /** Watches the bar and the title: the button sits above whichever is taller. */
  declare private resizer: ResizeObserver | null;

  constructor() {
    super();
    this.marker = null;
    this.resizer = null;
    const root = this.attachShadow({ mode: 'open' });
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.setAttribute('part', 'button');
    this.button.textContent = 'Skip';
    this.button.addEventListener('click', () => {
      const video = this.player?.video;
      if (video !== undefined && this.marker !== null) video.currentTime = this.marker.end;
    });
    root.append(style(BUTTON_STYLE + STYLE_CSS), this.button);
  }

  override connectedCallback(): void {
    // Hidden until playback is in a marker; a constructor may not set attributes.
    this.hidden = true;
    super.connectedCallback();
  }

  protected override attach(player: PlayerHost): void {
    this.listen(player.video, ['timeupdate', 'seeking', 'emptied'], () => {
      this.render();
    });
    this.listen(player, ['markerschange'], () => {
      this.render();
    });
    // The title shows while paused, and its text sits above the bar.
    this.listen(player.video, ['play', 'pause', 'ended'], () => {
      this.fit(player);
    });
    if (typeof ResizeObserver !== 'undefined') {
      this.resizer = new ResizeObserver(() => {
        this.fit(player);
      });
      this.resizer.observe(player);
      for (const tag of ['mbx-control-bar', 'mbx-title']) {
        const node = player.querySelector(tag);
        if (node !== null) this.resizer.observe(node);
      }
    }
    this.fit(player);
    this.render();
  }

  protected override detach(): void {
    this.resizer?.disconnect();
    this.resizer = null;
  }

  /**
   * Lifts the button above the bar's rows, or above the title's text while
   * it shows: each one's box less the padding over its content, which is
   * its fade. A hidden title has no box.
   */
  private fit(player: PlayerHost): void {
    let lift = 0;
    for (const tag of ['mbx-control-bar', 'mbx-title']) {
      const node = player.querySelector(tag);
      if (node === null) continue;
      const fade = Number.parseFloat(getComputedStyle(node).paddingTop) || 0;
      lift = Math.max(lift, node.getBoundingClientRect().height - fade);
    }
    this.style.setProperty('--mbx-marker-lift', `${lift}px`);
  }

  protected override render(): void {
    const player = this.player;
    this.marker =
      player?.markers
        .within(player.video.currentTime)
        .find((marker) => marker.kind !== 'blocked') ?? null;
    this.hidden = this.marker === null;
    if (this.marker === null) return;
    const kind = this.marker.kind;
    const skip = this.getAttribute('label-skip') ?? 'Skip';
    this.button.textContent =
      this.getAttribute(`label-${kind}`) ??
      WORDS[kind] ??
      (this.marker.label === undefined ? skip : `${skip} ${this.marker.label}`);
  }
}
