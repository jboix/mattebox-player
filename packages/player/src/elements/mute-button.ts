/**
 * <mbx-mute-button>: mute and unmute, with the level drawn in the glyph:
 * `icon-mute` while muted or at zero, `icon-low` up to half, `icon-high`
 * above. Unmuting at zero volume would change nothing the viewer can
 * hear, so it brings the volume up too. The name comes from `label-mute`
 * and `label-unmute`, and `aria-pressed` says which state it is in.
 */
import { icon } from '../controls/icons.js';
import type { PlayerHost } from '../host.js';
import { Component } from './component.js';
import { BUTTON_STYLE, iconSlots, show, style } from './shared.js';

type Level = 'mute' | 'low' | 'high';
const LEVELS: readonly Level[] = ['mute', 'low', 'high'];

export class MbxMuteButton extends Component {
  static get observedAttributes(): readonly string[] {
    return ['label-mute', 'label-unmute'];
  }

  declare private readonly button: HTMLButtonElement;
  declare private readonly slots: Record<Level, HTMLSlotElement>;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.setAttribute('part', 'button');
    this.slots = iconSlots(LEVELS, (level) =>
      icon(level === 'mute' ? 'mute' : level === 'low' ? 'volume-low' : 'volume-high'),
    );
    for (const level of LEVELS) this.button.append(this.slots[level]);
    this.button.addEventListener('click', () => {
      this.toggle();
    });
    root.append(style(BUTTON_STYLE), this.button);
  }

  private toggle(): void {
    const video = this.player?.video;
    if (video === undefined) return;
    if (video.muted) {
      video.muted = false;
      if (video.volume === 0) video.volume = 1;
    } else {
      video.muted = true;
    }
  }

  protected override attach(player: PlayerHost): void {
    this.listen(player.video, ['volumechange', 'emptied'], () => {
      this.render();
    });
    this.render();
  }

  protected override render(): void {
    const video = this.player?.video;
    if (video === undefined) return;
    const silent = video.muted || video.volume === 0;
    show(this.slots, silent ? 'mute' : video.volume <= 0.5 ? 'low' : 'high');
    this.button.setAttribute(
      'aria-label',
      silent
        ? (this.getAttribute('label-unmute') ?? 'Unmute')
        : (this.getAttribute('label-mute') ?? 'Mute'),
    );
    this.button.setAttribute('aria-pressed', String(video.muted));
  }
}
