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
 * read, and `scrubbing` while a pointer holds the thumb: `playing` or
 * `paused`, the state before the drag, which the play buttons show
 * instead of the drag's own pause.
 *
 * Reads happen on the events the video already fires; the live window has
 * no event of its own and moves with the clock, so `timeupdate` covers it.
 * While a pointer holds the thumb, the played layer follows the pointer.
 * The element carries `dragging` meanwhile. With an I-frame track
 * (`engine.trick.available`), the drag scrubs: the video pauses and shows
 * the I-frame at every position, and the release seeks there. See the
 * engine guide's trick play chapter. `scrub="false"` turns this off.
 * Otherwise the video pauses, `currentTime` is written at most once per
 * frame, so the bar never fights a slow seek, and the release resumes
 * playback if it was playing. Thumbnail tiles never drive a drag: they are
 * previews, not frames of the video.
 *
 * The preview above the pointer carries the time and a picture of that
 * time, the first the session offers of two. The decoded I-frame from
 * `engine.trick.frameAt`, when the track decodes in this browser. The last
 * frame stays until the next one arrives, so the picture never flickers
 * while the engine decodes. The tile from `engine.thumbnails`: a rectangle
 * of a sprite, drawn by background position at the sprite's own size. Both
 * scale to `--mbx-preview-width`, so a page sets the size with one token.
 *
 * Chapters divide the track: one gap per chapter boundary, cut through
 * every layer with a mask, so the played and the buffered spans read per
 * chapter, and the preview names the chapter under the pointer. They are
 * the video's own chapters track, see `controls/chapters.ts`.
 * `chapters="none"` leaves the track whole and the preview without a name.
 *
 * `step` is what an arrow key moves the playhead by and `page` what Page
 * Up and Page Down do, in seconds. The name comes from `label`; what a
 * screen reader hears at a position from `label-of`, "{current} of
 * {duration}", and on live from `label-behind`, "{time} behind live". It
 * sits in the bar's seek row unless the page says otherwise.
 */

import type { Chapter } from '../controls/chapters.js';
import { chapterAt, chapters, followChapters } from '../controls/chapters.js';
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

/** What a drag does, chosen when the pointer takes the thumb. */
type Drag = 'none' | 'seek' | 'scrub';

const STEP = 5;
const PAGE = 30;
const LIVE_WINDOW = 3;

/** What the tile scales down to when the page sets no `--mbx-preview-width`. */
const PREVIEW_WIDTH = 160;

/** The buffer goal assumed for a session that reports none. */
const BUFFER_GOAL = 30;

/** The gap cut at a chapter boundary, in pixels. */
const GAP = 2;

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
[part~="preview-frame"] { display: block; border-radius: 2px; }
[part~="preview-tile"] { position: absolute; top: 0; left: 0; transform-origin: top left; background-repeat: no-repeat; }
[part~="preview-time"] { padding: 0 4px; }
[part~="preview-title"] { max-width: 240px; padding: 0 4px; overflow: hidden; text-overflow: ellipsis; }
[hidden] { display: none; }
`;

function percent(part: number): string {
  return `${part * 100}%`;
}

/**
 * A mask that cuts a gap at each boundary between chapters, as stops along
 * the track: opaque up to a boundary, clear for the gap, opaque after.
 */
function gaps(list: readonly Chapter[], span: Span): string {
  const stops: string[] = ['#000 0'];
  for (const chapter of list.slice(1)) {
    const at = percent(fraction(chapter.start, span));
    const before = `calc(${at} - ${GAP / 2}px)`;
    const after = `calc(${at} + ${GAP / 2}px)`;
    stops.push(`#000 ${before}`, `transparent ${before}`, `transparent ${after}`, `#000 ${after}`);
  }
  stops.push('#000 100%');
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

export class MbxSeekBar extends Component {
  static get observedAttributes(): readonly string[] {
    return ['label', 'label-of', 'label-behind', 'live-window', 'chapters', 'scrub'];
  }

  declare private readonly bar: Slider;
  declare private readonly buffered: HTMLElement;
  declare private readonly hover: HTMLElement;
  declare private readonly edge: HTMLElement;
  declare private readonly preview: HTMLElement;
  declare private readonly image: HTMLElement;
  declare private readonly tile: HTMLElement;
  declare private readonly time: HTMLElement;
  declare private readonly caption: HTMLElement;
  declare private readonly frameCanvas: HTMLCanvasElement;
  declare private drag: Drag;
  /** The last position of the drag, which a cancelled drag settles at. */
  declare private dragged: number | null;
  /** Whether the video played when a seeking drag began, so the release resumes it. */
  declare private resume: boolean;
  /** Frames asked for, and the newest one on screen, so a late frame never replaces a newer one. */
  declare private asked: number;
  declare private shown: number;
  declare private range: Span;
  /** The chapters as last drawn, so the mask is written only when they change. */
  declare private divided: string;
  declare private list: Chapter[];
  declare private pending: number | null;
  declare private frame: number;

  constructor() {
    super();
    this.range = EMPTY;
    this.pending = null;
    this.frame = 0;
    this.divided = '';
    this.list = [];
    this.drag = 'none';
    this.dragged = null;
    this.resume = false;
    this.asked = 0;
    this.shown = 0;
    const root = this.attachShadow({ mode: 'open' });
    this.bar = slider({
      step: () => number(this, 'step', STEP),
      page: () => number(this, 'page', PAGE),
      onInput: (value) => {
        this.input(value);
      },
      onDrag: (on) => {
        this.toggleAttribute('dragging', on);
        if (on) this.dragStart();
        else this.dragEnd();
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
    this.caption = el('span', 'preview-title');
    this.caption.hidden = true;
    this.image.append(this.tile);
    this.image.hidden = true;
    this.frameCanvas = el('canvas', 'preview-frame');
    this.frameCanvas.hidden = true;
    this.preview.append(this.frameCanvas, this.image, this.caption, this.time);
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

  /** Whether the chapters divide the track and name the preview. */
  private chaptered(): boolean {
    return this.getAttribute('chapters') !== 'none' && this.list.length > 0;
  }

  /** The gaps at the chapter boundaries, on every layer of the track at once. */
  private paintChapters(): void {
    const mask = this.chaptered() && this.list.length > 1 ? gaps(this.list, this.range) : '';
    const key = `${mask}|${this.range.start}|${this.range.end}`;
    if (key === this.divided) return;
    this.divided = key;
    const track = this.bar.track.style;
    // Both spellings: WebKit before 15.4 knows only the prefixed one.
    track.setProperty('mask-image', mask === '' ? '' : mask);
    track.setProperty('-webkit-mask-image', mask === '' ? '' : mask);
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

  /** Scrubs when the session has an I-frame track and the page allows it; seeks otherwise. */
  private dragStart(): void {
    const trick = optional(this.player?.engine ?? null).trick;
    this.dragged = null;
    // The pause below is the drag's, not the viewer's: the player says so,
    // with the state from before, which the play buttons keep showing.
    const before = this.player?.video.paused === false ? 'playing' : 'paused';
    this.player?.setAttribute('scrubbing', before);
    if (trick?.available === true && this.getAttribute('scrub') !== 'false') {
      trick.scrubStart();
      this.drag = 'scrub';
    } else {
      // Paused for the drag, the way the scrub is: the picture follows the
      // pointer, and playback waits for the release.
      const video = this.player?.video;
      this.resume = video !== undefined && !video.paused;
      video?.pause();
      this.drag = 'seek';
    }
  }

  /**
   * The pointer let go. A release writes its own input next, in the same
   * task, and that settles the drag. A cancelled drag writes none, so the
   * drag settles at its last position once the task is over.
   */
  private dragEnd(): void {
    queueMicrotask(() => {
      if (this.drag !== 'none') this.settle(this.dragged);
    });
  }

  /** Ends the drag at `value`, or where it stands when there is none. */
  private settle(value: number | null): void {
    const drag = this.drag;
    this.drag = 'none';
    this.dragged = null;
    const player = this.player;
    if (player === null) return;
    if (drag === 'scrub') {
      const trick = optional(player.engine).trick;
      if (value === null) trick?.scrubEnd();
      else trick?.scrubEnd(value);
    } else {
      if (value !== null) player.video.currentTime = value;
      if (this.resume) void player.video.play().catch(() => undefined);
      this.resume = false;
    }
    // After the play, which clears `paused` at once, so the start button
    // never shows between the release and the resume.
    player.removeAttribute('scrubbing');
  }

  private input(value: number): void {
    const video = this.player?.video;
    if (video === undefined) return;
    this.bar.set(value, this.say(value));
    if (!this.bar.dragging()) {
      // The release, or a key: written now, and it supersedes whatever a
      // frame queued during the drag was about to write.
      this.pending = null;
      if (this.drag !== 'none') this.settle(value);
      else video.currentTime = value;
      return;
    }
    this.dragged = value;
    if (this.drag === 'scrub') {
      // The engine writes `currentTime` on every move; the browser drops a
      // seek a newer one supersedes, so no throttle is needed here.
      optional(this.player?.engine ?? null).trick?.scrubTo(value);
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

  /**
   * The picture in the preview: the decoded I-frame once one is on screen,
   * the tile until then. A scrub already shows the position in the video,
   * so the preview shows none meanwhile.
   */
  private paintPicture(when: number): void {
    if (this.drag === 'scrub') {
      this.image.hidden = true;
      this.frameCanvas.hidden = true;
      return;
    }
    const trick = optional(this.player?.engine ?? null).trick;
    // `previews` turns false once the engine knows no frame will come, such
    // as for TS I-frames; the tile shows then, without asking again.
    if (trick?.previews === true) {
      this.asked += 1;
      const request = this.asked;
      const width = this.previewWidth();
      // Null for a call a newer one replaced, and while the track's
      // segments load. The tile stays then.
      void trick.frameAt(when, { width: Math.round(width * devicePixelRatio) }).then(
        (bitmap) => {
          if (bitmap === null || request < this.shown || this.preview.hidden) return;
          this.shown = request;
          // The engine keeps the bitmap in its cache: drawn, never closed here.
          const canvas = this.frameCanvas;
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          canvas.style.width = `${width}px`;
          canvas.style.height = `${(bitmap.height / bitmap.width) * width}px`;
          canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
          canvas.hidden = false;
          this.image.hidden = true;
        },
        () => undefined,
      );
    }
    if (this.frameCanvas.hidden) this.paintTile(when);
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
    const chapter = this.chaptered() ? this.list[chapterAt(this.list, when)] : undefined;
    this.caption.hidden = chapter === undefined || chapter.title === '';
    this.caption.textContent = chapter?.title ?? '';
    this.paintPicture(when);
    const whole = this.bar.root.getBoundingClientRect();
    const half = this.preview.offsetWidth / 2;
    const x = rect.left - whole.left + part * rect.width;
    this.preview.style.left = `${Math.min(whole.width - half, Math.max(half, x))}px`;
  }

  private leave(): void {
    this.hover.hidden = true;
    this.preview.hidden = true;
    // The next hover starts from the tile, not a frame from elsewhere on the bar.
    this.frameCanvas.hidden = true;
  }

  protected override attach(player: PlayerHost): void {
    const tick = (): void => {
      this.render();
    };
    this.listen(player.video, EVENTS, tick);
    this.keep(followChapters(player, tick));
    this.listen(player, ['sourcechange'], () => {
      this.drag = 'none';
      this.leave();
      this.render();
    });
    this.render();
  }

  protected override detach(player: PlayerHost): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.pending = null;
    if (this.drag !== 'none') this.settle(null);
    this.leave();
    player.removeAttribute('live');
    player.removeAttribute('seekable');
    player.removeAttribute('scrubbing');
  }

  protected override render(): void {
    const player = this.player;
    if (player === null) return;
    const video = player.video;
    const engine = player.engine;
    const api = live(engine);
    const on = api !== undefined;
    this.range = span(video, engine);
    this.list = chapters(video, engine);
    this.bar.label(this.getAttribute('label') ?? 'Seek');
    this.bar.range(this.range.start, this.range.end);
    this.paintBuffered(video);
    this.paintChapters();
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
