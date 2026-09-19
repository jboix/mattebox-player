/**
 * <mbx-title>: the heading, the subheading and the artwork of what plays,
 * as a lower third across the picture above the bar: a scrim that fades
 * upward, the artwork in the first column, the two lines in the second,
 * so a heading alone sits on a band and never floats. The content comes
 * from attributes, `heading`,
 * `subheading` and `artwork`, because the stream carries none of it: a page
 * writes what it knows, and a Cast receiver writes what the sender said.
 * With none of the three the element draws nothing.
 *
 * Shown while the video is paused, which includes before the first play,
 * and hidden while it plays. The element carries `playing` for that rule,
 * so a page changes it in CSS: `mattebox-player[started] mbx-title
 * { display: none }` keeps it to the time before the first play, like the
 * poster, and `mattebox-player:hover mbx-title { display: flex }` brings it
 * back on hover. The height of the bar's rows, its box less the fade it
 * pads itself with, goes on the host as `--mbx-bar-rows`, so the text sits
 * just above the seek row while the band runs under the bar to the bottom
 * edge, one ramp with the bar's own fade. The scrim is the page's to
 * override. Placed first among the screens, so the start button, the
 * error screen and the spinner paint over its band.
 */
import { el } from '../dom.js';
import type { PlayerHost } from '../host.js';
import { Component } from './component.js';
import { style } from './shared.js';

const STYLE = `
:host {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: flex-end;
  gap: 14px;
  /* The band runs under the bar to the bottom edge, one ramp with the
     bar's own fade, so there is no seam where the bar begins; the text
     sits 12px above the bar's rows, inside the bar's fade. */
  padding: 72px calc(var(--mbx-pad) + 8px) calc(var(--mbx-bar-rows, 0px) + 12px);
  background: linear-gradient(to top, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.3) 45%, rgba(0, 0, 0, 0));
  color: var(--mbx-text);
  font: 400 14px/1.35 var(--mbx-font);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  pointer-events: none;
}
:host([playing]) { display: none; }
:host([empty]) { display: none; }
:host([hidden]) { display: none; }
[part~="artwork"] {
  flex: none;
  height: 72px;
  width: auto;
  max-width: 128px;
  border-radius: var(--mbx-radius);
  object-fit: cover;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.14);
}
[part~="artwork"][hidden] { display: none; }
[part~="text"] { display: flex; flex-direction: column; gap: 2px; min-width: 0; max-width: 60ch; }
[part~="heading"] {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
[part~="subheading"] { color: rgba(255, 255, 255, 0.78); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
[part~="heading"]:empty, [part~="subheading"]:empty { display: none; }
`;

export class MbxTitle extends Component {
  static get observedAttributes(): readonly string[] {
    return ['heading', 'subheading', 'artwork'];
  }

  declare private readonly artwork: HTMLImageElement;
  declare private readonly heading: HTMLElement;
  declare private readonly subheading: HTMLElement;
  /** Watches the player's box: the height of the bar's rows decides where the text sits. */
  declare private resizer: ResizeObserver | null;

  constructor() {
    super();
    this.resizer = null;
    const root = this.attachShadow({ mode: 'open' });
    this.artwork = el('img', 'artwork');
    this.artwork.alt = '';
    this.artwork.hidden = true;
    const text = el('div', 'text');
    this.heading = el('div', 'heading');
    this.subheading = el('div', 'subheading');
    text.append(this.heading, this.subheading);
    root.append(style(STYLE), this.artwork, text);
  }

  protected override attach(player: PlayerHost): void {
    this.listen(player.video, ['play', 'pause', 'ended', 'emptied'], () => {
      this.state(player);
    });
    if (typeof ResizeObserver !== 'undefined') {
      this.resizer = new ResizeObserver(() => {
        this.fit(player);
      });
      this.resizer.observe(player);
    }
    this.fit(player);
    this.state(player);
    this.render();
  }

  protected override detach(): void {
    this.resizer?.disconnect();
    this.resizer = null;
    this.removeAttribute('playing');
    this.style.removeProperty('--mbx-bar-rows');
  }

  /** `playing` on the element, for its own stylesheet and the page's. */
  private state(player: PlayerHost): void {
    this.toggleAttribute('playing', !player.video.paused);
  }

  /** The height of the bar's rows: its box less the padding above them, which is its fade. Zero without a bar. */
  private fit(player: PlayerHost): void {
    const bar = player.querySelector('mbx-control-bar');
    let rows = 0;
    if (bar !== null) {
      const top = Number.parseFloat(getComputedStyle(bar).paddingTop) || 0;
      rows = Math.max(0, bar.getBoundingClientRect().height - top);
    }
    this.style.setProperty('--mbx-bar-rows', `${rows}px`);
  }

  protected override render(): void {
    const heading = this.getAttribute('heading') ?? '';
    const subheading = this.getAttribute('subheading') ?? '';
    const artwork = this.getAttribute('artwork');
    this.heading.textContent = heading;
    this.subheading.textContent = subheading;
    if (artwork === null) {
      this.artwork.removeAttribute('src');
      this.artwork.hidden = true;
    } else {
      this.artwork.src = artwork;
      this.artwork.hidden = false;
    }
    this.toggleAttribute('empty', heading === '' && subheading === '' && artwork === null);
  }
}
