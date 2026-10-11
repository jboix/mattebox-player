/**
 * <mbx-up-next>: the card that offers the next item near the end of this
 * one. It shows from the item's closing credits, when the page marked
 * them, and in its last 10 seconds, with a countdown while auto-advance is
 * on. "Next episode" plays the next item now; the close button stays on
 * this one, and its end does not move on.
 *
 * While it shows, the player carries `upnext`, and the player's skip
 * button leaves the closing credits to the card. Under repeat one there is
 * no next item to offer. The words come from `label` (Up next),
 * `label-play` (Next episode), `label-dismiss` (Close), and
 * `label-countdown`, with `{seconds}` (in {seconds} s).
 */
import type { PlayerHost } from '@mattebox/player';
import BUTTON_STYLE from './button.css?inline';
import { icon } from './icons.js';
import { button, el, PlaylistControl, style } from './ui.js';
import STYLE from './up-next.css?inline';

/** Seconds before the end that the card shows without credits. */
const WINDOW = 10;

export class MbxUpNext extends PlaylistControl {
  static get observedAttributes(): readonly string[] {
    return ['label', 'label-play', 'label-dismiss', 'label-countdown'];
  }

  declare private readonly picture: HTMLImageElement;
  declare private readonly heading: HTMLElement;
  declare private readonly itemTitle: HTMLElement;
  declare private readonly countdown: HTMLElement;
  declare private readonly play: HTMLButtonElement;
  declare private readonly dismiss: HTMLButtonElement;
  /** The index whose card the viewer closed, so it stays closed for that item. */
  declare private closed: number;
  declare private resizer: ResizeObserver | null;

  constructor() {
    super();
    this.closed = -1;
    this.resizer = null;
    const root = this.attachShadow({ mode: 'open' });
    const card = el('div', 'card');
    this.picture = el('img', 'image');
    this.picture.alt = '';
    const text = el('div', 'text');
    this.heading = el('div', 'heading');
    this.itemTitle = el('div', 'title');
    this.countdown = el('div', 'countdown');
    this.play = button('play');
    this.play.addEventListener('click', () => {
      this.playlist?.next();
    });
    this.dismiss = button('button');
    this.dismiss.append(icon('close'));
    this.dismiss.addEventListener('click', () => {
      this.closed = this.playlist?.index ?? -1;
      this.playlist?.stay();
      this.render();
    });
    // The countdown sits on the heading's line, so the card keeps its height.
    const top = el('div', 'top');
    top.append(this.heading, this.countdown);
    text.append(top, this.itemTitle, this.play);
    card.append(this.picture, text, this.dismiss);
    root.append(style(BUTTON_STYLE + STYLE), card);
  }

  override connectedCallback(): void {
    // Hidden until the end comes; a constructor may not set attributes.
    this.hidden = true;
    super.connectedCallback();
  }

  protected override attach(player: PlayerHost): void {
    const render = (): void => {
      this.render();
    };
    for (const name of ['timeupdate', 'seeking', 'ended', 'emptied']) {
      player.video.addEventListener(name, render);
    }
    player.addEventListener('markerschange', render);
    // With the bar hidden, the card slides down to where the bar was.
    const idle = (): void => {
      this.toggleAttribute('idle', player.hasAttribute('idle'));
    };
    const watcher = new MutationObserver(idle);
    watcher.observe(player, { attributes: true, attributeFilter: ['idle'] });
    idle();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizer = new ResizeObserver(() => {
        this.fit(player);
      });
      this.resizer.observe(player);
      // The bar's height follows the player's size tier too.
      const bar = player.querySelector('mbx-control-bar');
      if (bar !== null) this.resizer.observe(bar);
    }
    this.fit(player);
    this.keep(() => {
      for (const name of ['timeupdate', 'seeking', 'ended', 'emptied']) {
        player.video.removeEventListener(name, render);
      }
      player.removeEventListener('markerschange', render);
      watcher.disconnect();
      this.resizer?.disconnect();
      this.resizer = null;
      player.removeAttribute('upnext');
    });
  }

  /** Above the bar's rows, as the player's skip button: the bar's box less its fade. */
  private fit(player: PlayerHost): void {
    const bar = player.querySelector('mbx-control-bar');
    const fade = bar === null ? 0 : Number.parseFloat(getComputedStyle(bar).paddingTop) || 0;
    const lift = bar === null ? 0 : bar.getBoundingClientRect().height - fade;
    this.style.setProperty('--mbx-up-next-lift', `${Math.max(0, lift)}px`);
  }

  protected render(): void {
    const player = this.player;
    const playlist = this.playlist;
    if (player === null) return;
    // A close holds for its item only.
    if (this.closed !== (playlist?.index ?? -1)) this.closed = -1;
    const video = player.video;
    const next = playlist?.upcoming ?? null;
    const left = video.duration - video.currentTime;
    const credits = player.markers
      .within(video.currentTime)
      .some((marker) => marker.kind === 'closing-credits');
    const ending = Number.isFinite(left) && left <= WINDOW && !video.ended;
    const shown =
      playlist !== null &&
      next !== null &&
      next !== playlist.item &&
      this.closed !== playlist.index &&
      (credits || ending);
    this.hidden = !shown;
    player.toggleAttribute('upnext', shown);
    if (!shown || next === null) return;
    const picture = next.artwork ?? next.poster;
    this.picture.hidden = picture === undefined;
    if (picture !== undefined && this.picture.getAttribute('src') !== picture) {
      this.picture.src = picture;
    }
    this.heading.textContent = this.getAttribute('label') ?? 'Up next';
    this.itemTitle.textContent = next.heading ?? next.src;
    this.play.textContent = this.getAttribute('label-play') ?? 'Next episode';
    this.dismiss.setAttribute('aria-label', this.getAttribute('label-dismiss') ?? 'Close');
    // The countdown says when auto-advance moves on by itself.
    const counting = ending && playlist?.autoadvance === true;
    this.countdown.hidden = !counting;
    if (counting) {
      this.countdown.textContent = (
        this.getAttribute('label-countdown') ?? 'in {seconds} s'
      ).replace('{seconds}', String(Math.max(0, Math.ceil(left))));
    }
  }
}
