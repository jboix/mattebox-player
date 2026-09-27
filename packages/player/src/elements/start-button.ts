/**
 * <mbx-start-button>: the large play in the middle of the picture, shown
 * while the video is paused, a replay once it has ended, gone while it
 * plays, while a fatal error is on screen, and while the seek bar holds
 * the video paused for a drag (the player carries `scrubbing`). It sits in the player
 * beside the video, not in the bar, so it is over the poster and inside
 * fullscreen, and gone while the player waits for data, where the spinner
 * takes the centre. The glyph is `icon-play` or `icon-replay`, the name
 * `label-play` or `label-replay`.
 */
import type { PlayerError } from '@mattebox/player-core';
import { icon } from '../controls/icons.js';
import type { PlayerHost } from '../host.js';
import { Component } from './component.js';
import { BUTTON_STYLE, iconSlots, show, style } from './shared.js';
import STYLE_CSS from './start-button.css?inline';

type State = 'play' | 'replay';
const STATES: readonly State[] = ['play', 'replay'];

const STYLE = BUTTON_STYLE + STYLE_CSS;

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
    this.listen(video, ['play', 'pause', 'ended', 'waiting', 'stalled', 'canplay'], () => {
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
    this.observe(player, ['scrubbing'], () => {
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
    // The player reflects `waiting` first: it listens from its constructor.
    const player = this.player;
    this.hidden =
      this.failed ||
      !video.paused ||
      player?.hasAttribute('waiting') === true ||
      player?.hasAttribute('scrubbing') === true;
  }
}
