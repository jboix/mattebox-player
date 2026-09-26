/**
 * <mbx-play-button>: play, pause, or replay once the media has ended. It
 * reads the video on the events the video already fires and writes one
 * thing back on click. The glyph is a slot per state, so a page drops its
 * own SVG into `icon-play`, `icon-pause` or `icon-replay`; the name is on
 * the button, from `label-play`, `label-pause` and `label-replay`, where a
 * screen reader reads it. While the seek bar holds the video paused for a
 * drag, the button shows the state from before the drag, which the player
 * carries as `scrubbing`.
 */
import { icon } from '../controls/icons.js';
import type { PlayerHost } from '../host.js';
import { Component } from './component.js';
import { BUTTON_STYLE, iconSlots, show, style } from './shared.js';

type State = 'play' | 'pause' | 'replay';
const STATES: readonly State[] = ['play', 'pause', 'replay'];
const LABELS: Readonly<Record<State, string>> = { play: 'Play', pause: 'Pause', replay: 'Replay' };

export class MbxPlayButton extends Component {
  static get observedAttributes(): readonly string[] {
    return STATES.map((state) => `label-${state}`);
  }

  declare private readonly button: HTMLButtonElement;
  declare private readonly slots: Record<State, HTMLSlotElement>;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.setAttribute('part', 'button');
    this.slots = iconSlots(STATES, icon);
    for (const state of STATES) this.button.append(this.slots[state]);
    this.button.addEventListener('click', () => {
      this.toggle();
    });
    root.append(style(BUTTON_STYLE), this.button);
  }

  private toggle(): void {
    const video = this.player?.video;
    if (video === undefined) return;
    if (video.paused) {
      // Rejected outside a user gesture on an unmuted video, which the
      // browser reports on the video's own error path; nothing to add.
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }

  protected override attach(player: PlayerHost): void {
    this.listen(player.video, ['play', 'pause', 'ended', 'emptied'], () => {
      this.render();
    });
    this.observe(player, ['scrubbing'], () => {
      this.render();
    });
    this.render();
  }

  protected override render(): void {
    const video = this.player?.video;
    if (video === undefined) return;
    const held = this.player?.getAttribute('scrubbing') ?? null;
    const paused = held === null ? video.paused : held === 'paused';
    const state: State = video.ended ? 'replay' : paused ? 'play' : 'pause';
    show(this.slots, state);
    this.button.setAttribute('aria-label', this.getAttribute(`label-${state}`) ?? LABELS[state]);
  }
}
