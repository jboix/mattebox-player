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
 * time from the sources `preview` names, in order of preference: `frames`
 * and `tiles`, "frames tiles" by default, `none` for no picture. A frame
 * is the decoded I-frame from `engine.trick.frameAt`, when the track
 * decodes in this browser; the last one stays until the next arrives, so
 * the picture never flickers while the engine decodes. A tile comes from
 * `engine.thumbnails`: a rectangle of a sprite, drawn by background
 * position at the sprite's own size. Both scale to `--mbx-preview-width`,
 * so a page sets the size with one token.
 *
 * Chapters divide the track: one gap per chapter boundary, cut through
 * every layer with a mask, so the played and the buffered spans read per
 * chapter, and the preview names the chapter under the pointer. They come
 * from the session, see `controls/chapters.ts`. `chapters` lists what the
 * bar does with them: `divided` and `titles`, both by default, one of
 * them alone, or `none`.
 *
 * `step` is what an arrow key moves the playhead by and `page` what Page
 * Up and Page Down do, in seconds. `key-mode="preview"`, for a TV, makes
 * the keys aim instead of seek: the thumb and the preview show the target,
 * a held key's step grows, and the seek comes on Enter, on leaving the bar,
 * or a second after the last key. Escape or Back drops the target. The
 * control bar's seeking keys, the arrows and fast forward and rewind
 * anywhere in the player, aim the same way: the bar asks through
 * `seekkey`, and the seek bar takes it. The default, `instant`, seeks on
 * every key. The name comes from `label`; what a
 * screen reader hears at a position from `label-of`, "{current} of
 * {duration}", and on live from `label-behind`, "{time} behind live". It
 * sits in the bar's seek row unless the page says otherwise.
 */

import type { Thumbnail } from 'mattebox/stages/thumbnails';
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
import STYLE_CSS from './seek-bar.css?inline';
import { number, SLIDER_STYLE, seekRow, style } from './shared.js';

/** What a drag does, chosen when the pointer takes the thumb. */
type Drag = 'none' | 'seek' | 'scrub';

/** Where the preview's picture comes from: decoded I-frames, or thumbnail tiles. */
type Preview = 'frames' | 'tiles';

const STEP = 5;

/** Under `key-mode="preview"`, a target seeks this long after the last key. */
const KEY_COMMIT_MS = 1000;
/** Key moves closer together than this are one hold, whose step grows. */
const REPEAT_GAP_MS = 400;
/** A held key's step grows by one step every this many moves... */
const MOVES_PER_STEP = 8;
/** ...up to this many steps a move. */
const MAX_STEPS = 12;

/** The keys that cancel a target: Escape, and Back as a remote sends it. */
const CANCEL_KEYS = ['Escape', 'GoBack', 'BrowserBack'];
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

const STYLE = SLIDER_STYLE + STYLE_CSS;

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
    return [
      'label',
      'label-of',
      'label-behind',
      'live-window',
      'chapters',
      'scrub',
      'preview',
      'key-mode',
    ];
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
  /** Under `key-mode="preview"`: where the keys aim, not yet sought to, or null. */
  declare private target: number | null;
  declare private commitTimer: number;
  /** The moves of the current hold, and when the last one came. */
  declare private moves: number;
  declare private lastMove: number;
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
    this.target = null;
    this.commitTimer = 0;
    this.moves = 0;
    this.lastMove = 0;
    const root = this.attachShadow({ mode: 'open' });
    this.bar = slider({
      step: () => this.keyStep(),
      page: () => number(this, 'page', PAGE),
      onInput: (value, key) => {
        if (key && this.previewing()) this.aim(value);
        else this.input(value);
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
      if (this.target === null) this.leave();
    });
    // Focus moving on: the target stands, as if the pause ran out.
    this.bar.root.addEventListener('blur', () => {
      if (this.target !== null) this.commit();
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

  /** Whether the chapters do `use`: `divided` the track, or name the preview with their `titles`. */
  private chaptered(use: 'divided' | 'titles'): boolean {
    if (this.list.length === 0) return false;
    const value = this.getAttribute('chapters');
    if (value === null) return true;
    const words = value.split(/\s+/);
    // A value naming neither, as `on` did, keeps both.
    return (
      words.includes(use) ||
      !words.some((word) => word === 'divided' || word === 'titles' || word === 'none')
    );
  }

  /** The gaps at the chapter boundaries, on every layer of the track at once. */
  private paintChapters(): void {
    const mask =
      this.chaptered('divided') && this.list.length > 1 ? gaps(this.list, this.range) : '';
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

  /** Whether keys aim a target with the preview instead of seeking at once. */
  private previewing(): boolean {
    return this.getAttribute('key-mode') === 'preview';
  }

  /** The step for a key on the slider itself. */
  private keyStep(): number {
    const base = number(this, 'step', STEP);
    return this.previewing() ? base * this.growth() : base;
  }

  /**
   * How many steps a key moves the target under `key-mode="preview"`. It
   * grows while the viewer holds the key, so a long film takes seconds to
   * cross, not minutes; a pause restarts it.
   */
  private growth(): number {
    const now = performance.now();
    if (now - this.lastMove > REPEAT_GAP_MS) this.moves = 0;
    this.moves += 1;
    this.lastMove = now;
    return Math.min(MAX_STEPS, 1 + Math.floor(this.moves / MOVES_PER_STEP));
  }

  /**
   * Aims at `value` without seeking: the thumb and the preview show it, and
   * the seek comes on Enter or once the keys pause. A TV decodes slowly, so
   * a seek per key would stutter where the preview already shows the place.
   */
  private aim(value: number): void {
    const time = Math.min(this.range.end, Math.max(this.range.start, value));
    this.target = time;
    this.bar.set(time, this.say(time));
    const span = this.range.end - this.range.start;
    if (span > 0) this.previewAt((time - this.range.start) / span);
    clearTimeout(this.commitTimer);
    this.commitTimer = window.setTimeout(() => {
      this.commit();
    }, KEY_COMMIT_MS);
  }

  /** Seeks to the target, if there is one. */
  private commit(): void {
    const target = this.target;
    this.stopAiming();
    const video = this.player?.video;
    if (target !== null && video !== undefined) video.currentTime = target;
  }

  /** Drops the target: the thumb goes back to the playhead. */
  private cancel(): void {
    this.stopAiming();
    this.render();
  }

  private stopAiming(): void {
    clearTimeout(this.commitTimer);
    this.commitTimer = 0;
    this.target = null;
    this.moves = 0;
    this.leave();
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

  /** The preview's picture sources from `preview`, in order of preference: frames then tiles by default. */
  private sources(): Preview[] {
    const value = this.getAttribute('preview');
    if (value === 'none') return [];
    const own = (value ?? '')
      .split(/\s+/)
      .filter((word): word is Preview => word === 'frames' || word === 'tiles');
    return own.length > 0 ? own : ['frames', 'tiles'];
  }

  /** `tile`, or none, drawn at its size and scaled to fit. */
  private paintTile(tile: Thumbnail | null): void {
    this.image.hidden = tile === null;
    if (tile === null) return;
    const scale = this.previewWidth() / tile.width;
    this.image.style.width = `${tile.width * scale}px`;
    this.image.style.height = `${tile.height * scale}px`;
    this.tile.style.width = `${tile.width}px`;
    this.tile.style.height = `${tile.height}px`;
    this.tile.style.backgroundImage = `url("${tile.url}")`;
    this.tile.style.backgroundPosition = `-${tile.x}px -${tile.y}px`;
    this.tile.style.transform = `scale(${scale})`;
  }

  /**
   * The picture in the preview, from the sources `preview` names, the first
   * that answers winning. A decoded frame arrives later than a tile, so
   * while frames lead, the tile stands in until one is on screen, and the
   * last frame stays until the next one arrives. A scrub already shows the
   * position in the video, so the preview shows none meanwhile.
   */
  private paintPicture(when: number): void {
    const sources = this.drag === 'scrub' ? [] : this.sources();
    const api = optional(this.player?.engine ?? null);
    const trick = api.trick;
    // `previews` turns false once the engine knows no frame will come, such
    // as for TS I-frames; the tile shows then, without asking again.
    const frames = sources.includes('frames') && trick?.previews === true;
    const tile = sources.includes('tiles') ? (api.thumbnails?.at(when) ?? null) : null;
    if (tile !== null && (sources[0] === 'tiles' || !frames)) {
      // A frame still decoding for an earlier position must not replace it.
      this.asked += 1;
      this.shown = this.asked;
      this.frameCanvas.hidden = true;
      this.paintTile(tile);
      return;
    }
    if (!frames || trick === undefined) {
      this.frameCanvas.hidden = true;
      this.paintTile(null);
      return;
    }
    this.asked += 1;
    const request = this.asked;
    const width = this.previewWidth();
    // Null for a call a newer one replaced, and while the track's segments
    // load. What is on screen stays then.
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
    if (this.frameCanvas.hidden) this.paintTile(tile);
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
    this.previewAt(part);
  }

  /** The preview over `part` of the bar: the time, the chapter, and the picture. */
  private previewAt(part: number): void {
    const rect = this.bar.rail.getBoundingClientRect();
    if (rect.width === 0 || this.range.end <= this.range.start) return;
    this.preview.hidden = false;
    const when = at(part, this.range);
    this.time.textContent = this.label(when);
    const chapter = this.chaptered('titles') ? this.list[chapterAt(this.list, when)] : undefined;
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
      this.stopAiming();
      this.render();
    });
    // Under `key-mode="preview"`, the control bar's seeking keys aim: it
    // asks through `seekkey` before it seeks, and a taken event does not.
    this.listen(player, ['seekkey'], (event: Event) => {
      const asked = event as CustomEvent<{ readonly by: number }>;
      if (!this.previewing() || this.hidden || asked.defaultPrevented) return;
      asked.preventDefault();
      this.aim((this.target ?? player.video.currentTime) + asked.detail.by * this.growth());
    });
    // While a target stands, Enter seeks to it and Escape or Back drops it,
    // wherever focus is: on the bar, or anywhere the seeking keys came from.
    // Bubbling, so a focused control has its say first.
    this.listen(player, ['keydown'], (event: Event) => {
      const key = event as KeyboardEvent;
      if (this.target === null || key.defaultPrevented) return;
      // Enter on a button is that button's.
      if (key.key === 'Enter' && !(key.composedPath()[0] instanceof HTMLButtonElement)) {
        this.commit();
      } else if (CANCEL_KEYS.includes(key.key)) {
        this.cancel();
      } else return;
      key.preventDefault();
    });
    this.render();
  }

  protected override detach(player: PlayerHost): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.pending = null;
    if (this.drag !== 'none') this.settle(null);
    this.stopAiming();
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
    if (!this.bar.dragging() && this.target === null) {
      this.bar.set(video.currentTime, this.say(video.currentTime));
    }
  }
}
