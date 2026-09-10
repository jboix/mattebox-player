/**
 * <mbx-seek-bar>: the bar over the slider primitive, with four layers on
 * its track, every one a part: the buffered ranges from `video.buffered`,
 * the played span, the hover position, and for live the edge from
 * `engine.live`. The span it maps is the availability window for live and
 * the duration for VOD; `controls/session.ts` says which.
 *
 * A live stream is seekable only when the window is worth it: at least
 * `live-window` forward buffer goals long, the goal read from the engine.
 * Below that the bar hides. VOD is always seekable. The element sets
 * `live` and `seekable` on the player, which the time and the live button
 * read.
 *
 * Reads happen on the events the video already fires; the live window has
 * no event of its own and moves with the clock, so `timeupdate` covers it.
 * While a pointer holds the thumb, the played layer follows the pointer and
 * `currentTime` is written at most once per frame, so the bar never fights
 * a slow seek. The element carries `dragging` meanwhile.
 *
 * The preview above the pointer carries the time and, when the session's
 * `engine.thumbnails` answers for that time, the tile: a rectangle of a
 * sprite, drawn by background position at the sprite's own size and scaled
 * down to `--mbx-preview-width`, so a page sets the size with one token.
 *
 * `step` is what an arrow key moves the playhead by and `page` what Page
 * Up and Page Down do, in seconds. The name comes from `label`; what a
 * screen reader hears at a position from `label-of`, "{current} of
 * {duration}", and on live from `label-behind`, "{time} behind live". It
 * sits in the bar's seek row unless the page says otherwise.
 */

import type { Span } from '../controls/ranges.js';
import { at, clip, EMPTY, fraction } from '../controls/ranges.js';
import { bufferGoal, live, optional, span, wall } from '../controls/session.js';
import type { Slider } from '../controls/slider.js';
import { slider } from '../controls/slider.js';
import { format } from '../controls/time.js';
import { el } from '../dom.js';
import type { PlayerHost } from '../host.js';
import { fill } from '../labels.js';
import { Component } from './component.js';
import { number, SLIDER_STYLE, seekRow, style } from './shared.js';

const STEP = 5;
const PAGE = 30;
const LIVE_WINDOW = 3;

/** What the tile scales down to when the page sets no `--mbx-preview-width`. */
const PREVIEW_WIDTH = 160;

/** The buffer goal assumed for a session that reports none. */
const BUFFER_GOAL = 30;

const EVENTS = [
  'timeupdate',
  'progress',
  'durationchange',
  'loadedmetadata',
  'seeking',
  'seeked',
  'emptied',
];

const STYLE = `${SLIDER_STYLE}
:host { flex: 1; }
[part~="slider"] { flex: 1; }
[part~="thumb"] { width: 16px; height: 16px; margin: -8px 0 0 -8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4); }
[part~="buffered"] { position: absolute; top: 0; right: 0; bottom: 0; left: 0; }
[part~="buffered-range"] { position: absolute; top: 0; bottom: 0; background: rgba(255, 255, 255, 0.3); }
[part~="hover"] { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--mbx-text); }
[part~="edge"] { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--mbx-live); }
[part~="preview"] {
  position: absolute;
  bottom: 100%;
  margin-bottom: 4px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: var(--mbx-surface);
  border-radius: var(--mbx-radius);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
}
[part~="preview-image"] { position: relative; overflow: hidden; border-radius: 2px; }
[part~="preview-tile"] { position: absolute; top: 0; left: 0; transform-origin: top left; background-repeat: no-repeat; }
[part~="preview-time"] { padding: 0 4px; }
[hidden] { display: none; }
`;

function percent(part: number): string {
  return `${part * 100}%`;
}

export class MbxSeekBar extends Component {
  static get observedAttributes(): readonly string[] {
    return ['label', 'label-of', 'label-behind', 'live-window'];
  }

  declare private readonly bar: Slider;
  declare private readonly buffered: HTMLElement;
  declare private readonly hover: HTMLElement;
  declare private readonly edge: HTMLElement;
  declare private readonly preview: HTMLElement;
  declare private readonly image: HTMLElement;
  declare private readonly tile: HTMLElement;
  declare private readonly time: HTMLElement;
  declare private range: Span;
  declare private pending: number | null;
  declare private frame: number;

  constructor() {
    super();
    this.range = EMPTY;
    this.pending = null;
    this.frame = 0;
    const root = this.attachShadow({ mode: 'open' });
    this.bar = slider({
      step: () => number(this, 'step', STEP),
      page: () => number(this, 'page', PAGE),
      onInput: (value) => {
        this.input(value);
      },
      onDrag: (on) => {
        this.toggleAttribute('dragging', on);
      },
    });
    this.buffered = el('div', 'buffered');
    this.hover = el('div', 'hover');
    this.edge = el('div', 'edge');
    this.hover.hidden = true;
    this.edge.hidden = true;
    // Under the fill, so what is played reads over what is buffered.
    this.bar.track.prepend(this.buffered);
    this.bar.track.append(this.hover, this.edge);
    this.preview = el('div', 'preview');
    this.image = el('div', 'preview-image');
    this.tile = el('div', 'preview-tile');
    this.time = el('span', 'preview-time');
    this.image.append(this.tile);
    this.image.hidden = true;
    this.preview.append(this.image, this.time);
    this.preview.hidden = true;
    this.bar.root.append(this.preview);
    this.bar.root.addEventListener('pointermove', (event) => {
      this.point(event);
    });
    this.bar.root.addEventListener('pointerleave', () => {
      this.leave();
    });
    root.append(style(STYLE), this.bar.root);
  }

  override connectedCallback(): void {
    seekRow(this);
    super.connectedCallback();
  }

  private isLive(): boolean {
    return live(this.player?.engine ?? null) !== undefined;
  }

  /** What a screen reader hears at a time. */
  private say(time: number): string {
    const engine = this.player?.engine ?? null;
    if (!this.isLive()) {
      const template = this.getAttribute('label-of') ?? '{current} of {duration}';
      return Number.isFinite(this.range.end) && this.range.end > 0
        ? fill(template, { current: format(time), duration: format(this.range.end) })
        : format(time);
    }
    const behind = fill(this.getAttribute('label-behind') ?? '{time} behind live', {
      time: format(this.range.end - time),
    });
    const clock = wall(engine, time);
    return clock === null ? behind : `${clock}, ${behind}`;
  }

  /** What the preview shows at a time. */
  private label(time: number): string {
    if (!this.isLive()) return format(time);
    return wall(this.player?.engine ?? null, time) ?? `-${format(this.range.end - time)}`;
  }

  private input(value: number): void {
    const video = this.player?.video;
    if (video === undefined) return;
    this.bar.set(value, this.say(value));
    if (!this.bar.dragging()) {
      // The release, or a key: written now, and it supersedes whatever a
      // frame queued during the drag was about to write.
      this.pending = null;
      video.currentTime = value;
      return;
    }
    this.pending = value;
    if (this.frame === 0) {
      this.frame = requestAnimationFrame(() => {
        this.flush();
      });
    }
  }

  private flush(): void {
    this.frame = 0;
    const video = this.player?.video;
    if (this.pending === null || video === undefined) return;
    video.currentTime = this.pending;
    this.pending = null;
  }

  /** The width the page asked for through the token, or the default. */
  private previewWidth(): number {
    const set = Number.parseFloat(
      getComputedStyle(this.preview).getPropertyValue('--mbx-preview-width'),
    );
    return Number.isFinite(set) && set > 0 ? set : PREVIEW_WIDTH;
  }

  /** The tile for a time, if the track has one, drawn at its size and scaled to fit. */
  private paintTile(when: number): void {
    const found = optional(this.player?.engine ?? null).thumbnails?.at(when) ?? null;
    this.image.hidden = found === null;
    if (found === null) return;
    const scale = this.previewWidth() / found.width;
    this.image.style.width = `${found.width * scale}px`;
    this.image.style.height = `${found.height * scale}px`;
    this.tile.style.width = `${found.width}px`;
    this.tile.style.height = `${found.height}px`;
    this.tile.style.backgroundImage = `url("${found.url}")`;
    this.tile.style.backgroundPosition = `-${found.x}px -${found.y}px`;
    this.tile.style.transform = `scale(${scale})`;
  }

  private paintBuffered(video: HTMLVideoElement): void {
    const parts = clip(
      Array.from({ length: video.buffered.length }, (_, i) => ({
        start: video.buffered.start(i),
        end: video.buffered.end(i),
      })),
      this.range,
    );
    const buffered = this.buffered;
    while (buffered.childElementCount > parts.length) buffered.lastElementChild?.remove();
    while (buffered.childElementCount < parts.length) buffered.append(el('div', 'buffered-range'));
    let i = 0;
    for (const child of buffered.children) {
      const part = parts[i];
      i += 1;
      if (part === undefined) break;
      const node = child as HTMLElement;
      node.style.left = percent(part[0]);
      node.style.width = percent(part[1] - part[0]);
    }
  }

  /** Whether a live window is wide enough to be worth a bar. */
  private worthSeeking(): boolean {
    const goals = number(this, 'live-window', LIVE_WINDOW);
    if (goals === 0) return true;
    const goal = bufferGoal(this.player?.engine ?? null) ?? BUFFER_GOAL;
    return this.range.end - this.range.start >= goals * goal;
  }

  /** The hover marker and the preview follow the pointer, clamped to the bar. */
  private point(event: PointerEvent): void {
    const rect = this.bar.rail.getBoundingClientRect();
    if (rect.width === 0 || this.range.end <= this.range.start) return;
    const part = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    this.hover.hidden = false;
    this.hover.style.left = percent(part);
    this.preview.hidden = false;
    const when = at(part, this.range);
    this.time.textContent = this.label(when);
    this.paintTile(when);
    const whole = this.bar.root.getBoundingClientRect();
    const half = this.preview.offsetWidth / 2;
    const x = rect.left - whole.left + part * rect.width;
    this.preview.style.left = `${Math.min(whole.width - half, Math.max(half, x))}px`;
  }

  private leave(): void {
    this.hover.hidden = true;
    this.preview.hidden = true;
  }

  protected override attach(player: PlayerHost): void {
    const tick = (): void => {
      this.render();
    };
    this.listen(player.video, EVENTS, tick);
    this.listen(player, ['sourcechange'], () => {
      this.leave();
      this.render();
    });
    this.render();
  }

  protected override detach(player: PlayerHost): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.pending = null;
    this.leave();
    player.removeAttribute('live');
    player.removeAttribute('seekable');
  }

  protected override render(): void {
    const player = this.player;
    if (player === null) return;
    const video = player.video;
    const engine = player.engine;
    const api = live(engine);
    const on = api !== undefined;
    this.range = span(video, engine);
    this.bar.label(this.getAttribute('label') ?? 'Seek');
    this.bar.range(this.range.start, this.range.end);
    this.paintBuffered(video);
    this.edge.hidden = !on;
    if (api !== undefined && api.edge !== null) {
      this.edge.style.left = percent(fraction(api.edge, this.range));
    }
    const seekable = !on || this.worthSeeking();
    this.hidden = !seekable;
    player.toggleAttribute('live', on);
    player.toggleAttribute('seekable', seekable);
    if (!this.bar.dragging()) this.bar.set(video.currentTime, this.say(video.currentTime));
  }
}
