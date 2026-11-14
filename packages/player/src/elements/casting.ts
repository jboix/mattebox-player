/**
 * <mbx-casting>: what the picture shows while a device plays in the
 * video's place. The programme's poster, or its image, covers the paused
 * video, with a line that names the device: "Casting to Living room". The
 * controls stay as they are and drive the device.
 *
 * Shown while the player carries `casting`, for a Chromecast and for
 * AirPlay alike, and hidden otherwise. The element carries `casting` too,
 * with the device's kind, so a page styles one kind in CSS. Safari names no AirPlay device, so
 * the line is "AirPlay" there. The `label` attribute gives the line its
 * words, with `{device}` for the name. Placed first among the screens, so
 * the title, the start button and the bar paint over it.
 */
import { el } from '../dom.js';
import type { PlayerHost } from '../host.js';
import { fill } from '../labels.js';
import STYLE from './casting.css?inline';
import { Component } from './component.js';
import { style } from './shared.js';

export class MbxCasting extends Component {
  static get observedAttributes(): readonly string[] {
    return ['label'];
  }

  declare private readonly poster: HTMLImageElement;
  declare private readonly label: HTMLElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    this.poster = el('img', 'poster');
    this.poster.alt = '';
    this.poster.hidden = true;
    this.label = el('div', 'label');
    // Said once when the device takes over.
    this.label.setAttribute('role', 'status');
    root.append(style(STYLE), this.poster, this.label);
  }

  protected override attach(player: PlayerHost): void {
    this.listen(player, ['programmechange'], () => {
      this.render();
    });
    this.render();
  }

  protected override detach(): void {
    this.removeAttribute('casting');
  }

  protected override render(): void {
    const player = this.player;
    const target = player?.casting ?? null;
    // The device's kind on the element, for its own stylesheet and the page's.
    if (target === null) this.removeAttribute('casting');
    else this.setAttribute('casting', target.kind);
    if (player === null || target === null) return;
    const metadata = player.programme?.metadata;
    const poster = metadata?.poster ?? metadata?.image ?? player.getAttribute('poster');
    this.poster.hidden = poster === null || poster === undefined;
    if (poster !== null && poster !== undefined && this.poster.getAttribute('src') !== poster) {
      this.poster.src = poster;
    }
    this.label.textContent =
      target.name === ''
        ? target.kind === 'airplay'
          ? this.word('label', 'airplay', 'AirPlay')
          : ''
        : fill(this.word('label', 'castingTo', 'Casting to {device}'), { device: target.name });
  }
}
