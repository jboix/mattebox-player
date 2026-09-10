/**
 * <mbx-skip-button>: moves the playhead by `seconds`, negative for back,
 * within what the video can reach. The glyph says the amount where the
 * set has one, 10 and 30, and a plain arrow otherwise; `icon` takes a
 * page's own. The name comes from `label`, where `{seconds}` is the
 * amount without its sign: "Back {seconds} seconds".
 */
import type { IconName } from '../controls/icons.js';
import { icon } from '../controls/icons.js';
import type { PlayerHost } from '../host.js';
import { fill } from '../labels.js';
import { Component } from './component.js';
import { BUTTON_STYLE, style } from './shared.js';

const SECONDS = 10;

/** The glyph for a skip amount: the set draws 10 and 30, and a plain arrow says the rest. */
function glyphFor(back: boolean, amount: number): IconName {
  const side = back ? 'seek-backward' : 'seek-forward';
  if (amount === 10 || amount === 30) return `${side}-${amount}`;
  return side;
}

export class MbxSkipButton extends Component {
  static get observedAttributes(): readonly string[] {
    return ['seconds', 'label'];
  }

  declare private readonly button: HTMLButtonElement;
  declare private readonly glyph: HTMLSlotElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.setAttribute('part', 'button');
    this.glyph = document.createElement('slot');
    this.glyph.name = 'icon';
    this.button.append(this.glyph);
    this.button.addEventListener('click', () => {
      this.skip();
    });
    root.append(style(BUTTON_STYLE), this.button);
  }

  /** The amount, signed. A value that is not a number is the default. */
  private seconds(): number {
    const value = Number(this.getAttribute('seconds') ?? SECONDS);
    return Number.isFinite(value) ? value : SECONDS;
  }

  private skip(): void {
    const video = this.player?.video;
    if (video === undefined) return;
    const ranges = video.seekable;
    const end = Number.isFinite(video.duration)
      ? video.duration
      : ranges.length > 0
        ? ranges.end(ranges.length - 1)
        : video.currentTime;
    video.currentTime = Math.min(end, Math.max(0, video.currentTime + this.seconds()));
  }

  protected override attach(_player: PlayerHost): void {
    this.render();
  }

  protected override render(): void {
    const seconds = this.seconds();
    const back = seconds < 0;
    const amount = Math.abs(seconds);
    this.glyph.replaceChildren(icon(glyphFor(back, amount)));
    const template =
      this.getAttribute('label') ?? (back ? 'Back {seconds} seconds' : 'Forward {seconds} seconds');
    this.button.setAttribute('aria-label', fill(template, { seconds: amount }));
  }
}
