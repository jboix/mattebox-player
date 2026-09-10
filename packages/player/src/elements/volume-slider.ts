/**
 * <mbx-volume-slider>: the volume over the slider primitive. It shows
 * zero while muted, and writing any level above zero unmutes: dragging
 * the volume up is how a viewer says they want to hear it. `step` is
 * what an arrow key moves it by and `page` what Page Up and Page Down
 * do, as fractions of one; the name comes from `label`. While a pointer
 * holds the thumb the element carries `dragging`.
 */
import type { Slider } from '../controls/slider.js';
import { slider } from '../controls/slider.js';
import type { PlayerHost } from '../host.js';
import { Component } from './component.js';
import { number, SLIDER_STYLE, style } from './shared.js';

const STEP = 0.05;
const PAGE = 0.2;

export class MbxVolumeSlider extends Component {
  static get observedAttributes(): readonly string[] {
    return ['label'];
  }

  declare private readonly bar: Slider;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    this.bar = slider({
      step: () => number(this, 'step', STEP),
      page: () => number(this, 'page', PAGE),
      onInput: (value) => {
        const video = this.player?.video;
        if (video === undefined) return;
        video.volume = value;
        if (value > 0) video.muted = false;
      },
      onDrag: (on) => {
        this.toggleAttribute('dragging', on);
      },
    });
    this.bar.range(0, 1);
    root.append(style(`${SLIDER_STYLE}:host { width: 80px; flex: none; }`), this.bar.root);
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
    this.bar.label(this.getAttribute('label') ?? 'Volume');
    const level = video.muted ? 0 : video.volume;
    this.bar.set(level, `${Math.round(level * 100)}%`);
  }
}
