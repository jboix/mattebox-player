/**
 * <mbx-marker-button>: "Skip intro" over the picture while playback is in
 * the opening credits, "Skip credits" in the closing ones, and "Skip" with
 * the marker's own label in any other range the page named. A press moves
 * the playhead to the range's end. Blocked ranges never show it: the
 * player moves past those itself. The words come from
 * `label-opening-credits`, `label-closing-credits` and `label-skip`.
 *
 * While the player carries `upnext`, set by a card that offers the next
 * item, the button leaves the closing credits to it.
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
    // An up next card, from a playlist, takes over the closing credits.
    this.observe(player, ['upnext'], () => {
      this.render();
    });
    // With the bar hidden, the button slides down to where the bar was.
    const idle = (): void => {
      this.toggleAttribute('idle', player.hasAttribute('idle'));
    };
    this.observe(player, ['idle'], idle);
    idle();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizer = new ResizeObserver(() => {
        this.fit(player);
      });
      this.resizer.observe(player);
      const bar = player.querySelector('mbx-control-bar');
      if (bar !== null) this.resizer.observe(bar);
    }
    this.fit(player);
    this.render();
  }

  protected override detach(): void {
    this.resizer?.disconnect();
    this.resizer = null;
  }

  /**
   * Lifts the button above the bar's rows: the bar's box less the padding
   * over them, its fade. The title sits on the other side, so the button
   * stays where it is while the title shows.
   */
  private fit(player: PlayerHost): void {
    const bar = player.querySelector('mbx-control-bar');
    const fade = bar === null ? 0 : Number.parseFloat(getComputedStyle(bar).paddingTop) || 0;
    const lift = bar === null ? 0 : bar.getBoundingClientRect().height - fade;
    this.style.setProperty('--mbx-marker-lift', `${Math.max(0, lift)}px`);
  }

  protected override render(): void {
    const player = this.player;
    this.marker =
      player?.markers
        .within(player.video.currentTime)
        .find((marker) => marker.kind !== 'blocked') ?? null;
    // A playlist's up next card offers the next item over the closing
    // credits, so this button steps aside while the player carries `upnext`.
    if (this.marker?.kind === 'closing-credits' && player?.hasAttribute('upnext') === true) {
      this.marker = null;
    }
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
