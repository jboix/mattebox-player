/**
 * <mbx-cast-screen>: covers the picture while the player casts, with the
 * receiver's name, play and pause, the seek slider, the time, and a stop
 * button. It drives the receiver through the SDK's remote player; the
 * video underneath stays paused and untouched (rule 3). It sits in the
 * player beside the video, hidden until the player carries `casting`.
 *
 * The title comes from `label` with `{device}`, the stop button's text from
 * `label-stop`, the play button's name from `label-play` and `label-pause`
 * and its glyph from `icon-play` and `icon-pause`, the slider's name from
 * `label-seek`. A live stream has no duration on the receiver, so the
 * slider and the time hide for it.
 */
import type { Cast } from './cast.js';
import { cast } from './cast.js';
import STYLE_CSS from './cast-screen.css?inline';
import { Component } from './component.js';
import type { PlayerHost } from './host.js';
import { icon } from './icons.js';
import {
  BUTTON_STYLE,
  describe,
  el,
  fill,
  format,
  iconSlots,
  SLIDER_STYLE,
  show,
  style,
} from './shared.js';
import type { Slider } from './slider.js';
import { slider } from './slider.js';

type State = 'play' | 'pause';
const STATES: readonly State[] = ['play', 'pause'];
const STEP = 5;
const PAGE = 30;

const STYLE = BUTTON_STYLE + SLIDER_STYLE + STYLE_CSS;

export class MbxCastScreen extends Component {
  static get observedAttributes(): readonly string[] {
    return ['label', 'label-stop', 'label-play', 'label-pause', 'label-seek'];
  }

  declare private readonly title_: HTMLElement;
  declare private readonly play: HTMLButtonElement;
  declare private readonly slots: Record<State, HTMLSlotElement>;
  declare private readonly seek: Slider;
  declare private readonly row: HTMLElement;
  declare private readonly time: HTMLElement;
  declare private readonly stop: HTMLButtonElement;
  declare private api: Cast | null;
  /** Where the thumb is while a pointer holds it, so the receiver's reports do not move it back. */
  declare private held: number | null;

  constructor() {
    super();
    this.api = null;
    this.held = null;
    const root = this.attachShadow({ mode: 'open' });
    const box = el('div', 'box');
    this.title_ = el('div', 'title');
    this.play = document.createElement('button');
    this.play.type = 'button';
    this.play.setAttribute('part', 'button play');
    this.slots = iconSlots(STATES, icon);
    for (const state of STATES) this.play.append(this.slots[state]);
    this.play.addEventListener('click', () => {
      this.api?.playPause();
    });
    this.seek = slider({
      step: () => STEP,
      page: () => PAGE,
      onInput: (value) => {
        if (this.seek.dragging()) {
          this.held = value;
          this.paint();
          return;
        }
        this.held = null;
        this.api?.seek(value);
      },
      onDrag: (on) => {
        this.toggleAttribute('dragging', on);
        if (!on) this.held = null;
      },
    });
    this.time = el('span', 'time');
    this.row = el('div', 'row');
    this.row.append(this.play, this.seek.root, this.time);
    this.stop = el('button', 'stop');
    this.stop.type = 'button';
    this.stop.addEventListener('click', () => {
      this.api?.stop();
    });
    box.append(this.title_, this.row, this.stop);
    root.append(style(STYLE), box);
  }

  /** Hidden before attaching: a constructor must not add attributes. */
  override connectedCallback(): void {
    if (this.player === null) this.hidden = true;
    super.connectedCallback();
  }

  protected override attach(player: PlayerHost): void {
    const api = cast(player);
    this.api = api;
    this.keep(
      api.watch(() => {
        this.render();
      }),
    );
    this.render();
  }

  protected override detach(): void {
    this.api = null;
    this.hidden = true;
  }

  /** The slider and the time, from the receiver or from the held thumb. */
  private paint(): void {
    const api = this.api;
    if (api === null) return;
    const remote = api.remote();
    const seekable = remote.loaded && Number.isFinite(remote.duration);
    this.seek.root.hidden = !seekable;
    this.time.hidden = !seekable;
    if (!seekable) return;
    const at = this.held ?? remote.time;
    this.seek.range(0, remote.duration);
    this.seek.set(at, describe(at, remote.duration));
    this.time.textContent = `${format(at)} / ${format(remote.duration)}`;
  }

  protected override render(): void {
    const api = this.api;
    if (api === null) return;
    const remote = api.remote();
    // Named while hidden too: a screen reader walks the tree either way.
    const state: State = remote.loaded && !remote.paused ? 'pause' : 'play';
    show(this.slots, state);
    this.play.setAttribute(
      'aria-label',
      this.getAttribute(`label-${state}`) ?? (state === 'play' ? 'Play' : 'Pause'),
    );
    this.seek.label(this.getAttribute('label-seek') ?? 'Seek');
    this.stop.textContent = this.getAttribute('label-stop') ?? 'Stop casting';
    const casting = api.state() === 'casting';
    this.hidden = !casting;
    if (!casting) return;
    this.title_.textContent = fill(this.getAttribute('label') ?? 'Casting to {device}', {
      device: api.device() ?? '',
    });
    this.play.disabled = !remote.loaded;
    this.paint();
  }
}
