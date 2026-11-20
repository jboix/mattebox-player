/**
 * <mbx-casting>: what the picture shows while a device plays in the
 * video's place. The programme's poster, or its image, covers the paused
 * video, dimmed, and the device's glyph sits over it with a line that names
 * the device: "Casting to Living room". The controls stay as they are and
 * drive the device, and the bar does not hide while it plays.
 *
 * Shown while the player carries `casting`, for a Chromecast and for
 * AirPlay alike, and hidden otherwise. The element carries `casting` too,
 * with the device's kind, so a page styles one kind in CSS. Safari names no AirPlay device, so
 * the line is "Playing on AirPlay" there. The `label` attribute gives the
 * line its words, with `{device}` for the name. `label-airplay` gives the
 * AirPlay line its words. Placed first among the screens, so the title, the
 * start button and the bar paint over it.
 */
import type { IconName } from '../controls/icons.js';
import { icon } from '../controls/icons.js';
import { el } from '../dom.js';
import type { PlayerHost } from '../host.js';
import { fill } from '../labels.js';
import STYLE from './casting.css?inline';
import { Component } from './component.js';
import { style } from './shared.js';

export class MbxCasting extends Component {
  static get observedAttributes(): readonly string[] {
    return ['label', 'label-airplay'];
  }

  declare private readonly poster: HTMLImageElement;
  declare private readonly device: HTMLElement;
  declare private readonly label: HTMLElement;
  /** The glyph on show, so a render that changes nothing leaves it in place. */
  declare private glyph: IconName | null;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    this.poster = el('img', 'poster');
    this.poster.alt = '';
    this.poster.hidden = true;
    this.device = el('div', 'device');
    this.label = el('div', 'label');
    // Said once when the device takes over.
    this.label.setAttribute('role', 'status');
    this.device.append(this.label);
    this.glyph = null;
    root.append(style(STYLE), this.poster, this.device);
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
    const glyph: IconName = target.kind === 'airplay' ? 'airplay-active' : 'cast';
    if (glyph !== this.glyph) {
      this.glyph = glyph;
      this.device.querySelector('svg')?.remove();
      this.device.insertBefore(icon(glyph), this.label);
    }
    this.label.textContent =
      target.name === ''
        ? target.kind === 'airplay'
          ? this.word('label-airplay', 'playingOnAirplay', 'Playing on AirPlay')
          : ''
        : fill(this.word('label', 'castingTo', 'Casting to {device}'), { device: target.name });
  }
}
