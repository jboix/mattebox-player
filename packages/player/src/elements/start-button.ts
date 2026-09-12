/**
 * <mbx-start-button>: the large play in the middle of the picture, shown
 * while the video is paused, a replay once it has ended, gone while it
 * plays and while a fatal error is on screen. It sits in the player
 * beside the video, not in the bar, so it is over the poster and inside
 * fullscreen. The glyph is `icon-play` or `icon-replay`, the name
 * `label-play` or `label-replay`.
 */
import type { PlayerError } from '@mattebox/player-core';
import { icon } from '../controls/icons.js';
import type { PlayerHost } from '../host.js';
import { Component } from './component.js';
import { BUTTON_STYLE, iconSlots, show, style } from './shared.js';

type State = 'play' | 'replay';
const STATES: readonly State[] = ['play', 'replay'];

const STYLE = `${BUTTON_STYLE}
:host {
  position: absolute;
  top: 50%;
  left: 50%;
  margin: -32px 0 0 -52px;
}
[part~="button"] {
  width: 104px;
  height: 64px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.45);
  color: var(--mbx-text);
  opacity: 0.9;
  transition: opacity 0.15s, background 0.15s;
}
[part~="button"]:hover { opacity: 1; background: rgba(0, 0, 0, 0.6); }
/* A box too short for the button above the bar: the bar's play does the job. */
:host([cramped]) { display: none; }
[part~="icon"], ::slotted(*) { width: 40px; height: 40px; margin-left: 2px; }
@media (prefers-reduced-motion: reduce) {
  [part~="button"] { transition: none; }
}
`;

export class MbxStartButton extends Component {
  static get observedAttributes(): readonly string[] {
    return ['label-play', 'label-replay'];
  }

  declare private readonly button: HTMLButtonElement;
  declare private readonly slots: Record<State, HTMLSlotElement>;
  /** A fatal error is on screen, and the play stays out of its way until playback or a load. */
  declare private failed: boolean;
  /** Watches the player's box: in a short one the button would sit over the bar. */
  declare private resizer: ResizeObserver | null;

  constructor() {
    super();
    this.failed = false;
    this.resizer = null;
    const root = this.attachShadow({ mode: 'open' });
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.setAttribute('part', 'button');
    this.slots = iconSlots(STATES, icon);
    for (const state of STATES) this.button.append(this.slots[state]);
    this.button.addEventListener('click', () => {
      this.player?.video.play().catch(() => undefined);
    });
    root.append(style(STYLE), this.button);
  }

  protected override attach(player: PlayerHost): void {
    const video = player.video;
    this.listen(video, ['play', 'pause', 'ended'], () => {
      this.render();
    });
    this.listen(video, ['playing', 'loadstart'], () => {
      this.failed = false;
      this.render();
    });
    this.listen(player, ['sourcechange'], () => {
      this.failed = false;
      this.render();
    });
    const failure = (event: Event): void => {
      const error = (event as CustomEvent<PlayerError>).detail;
      if (!error.fatal) return;
      this.failed = true;
      this.render();
    };
    player.addEventListener('error', failure);
    this.keep(() => {
      player.removeEventListener('error', failure);
    });
    this.failed = player.error !== null;
    if (typeof ResizeObserver !== 'undefined') {
      this.resizer = new ResizeObserver(() => {
        this.fit(player);
      });
      this.resizer.observe(player);
    }
    this.fit(player);
    this.render();
  }

  protected override detach(): void {
    this.resizer?.disconnect();
    this.resizer = null;
    this.removeAttribute('cramped');
  }

  /**
   * Cramped when the button's foot would be inside the bar's box, which
   * starts at the top of its gradient: then the bar's own play button is
   * the one to press. Measured with the button shown, since a hidden one
   * has no box.
   */
  private fit(player: PlayerHost): void {
    const bar = player.querySelector('mbx-control-bar');
    if (bar === null) {
      this.removeAttribute('cramped');
      return;
    }
    const wasHidden = this.hidden;
    const wasCramped = this.hasAttribute('cramped');
    this.hidden = false;
    this.removeAttribute('cramped');
    const cramped = this.button.getBoundingClientRect().bottom > bar.getBoundingClientRect().top;
    this.hidden = wasHidden;
    this.toggleAttribute('cramped', cramped);
    if (cramped !== wasCramped) this.render();
  }

  protected override render(): void {
    const video = this.player?.video;
    if (video === undefined) return;
    const state: State = video.ended ? 'replay' : 'play';
    show(this.slots, state);
    this.button.setAttribute(
      'aria-label',
      this.getAttribute(`label-${state}`) ?? (state === 'play' ? 'Play' : 'Replay'),
    );
    this.hidden = this.failed || !video.paused;
  }
}
