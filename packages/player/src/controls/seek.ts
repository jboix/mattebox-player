/**
 * The seek row: the time on the left, the bar, and the duration on the
 * right, with the live button appended by the bar. Four layers on the
 * track, every one a part: the buffered ranges from `video.buffered`, the
 * played span, the hover position, and for live the edge from
 * `engine.live`. The span it maps is the availability window for live,
 * read from `video.seekable`, and the duration for VOD.
 *
 * A live stream is seekable only when the window is worth it: at least
 * `liveWindow` forward buffer goals long, the goal read from the engine.
 * Below that the bar and the time stay hidden and the row is the live
 * button alone. VOD is always seekable. The window is the engine's own
 * where the session offers it: the browser's seekable range on a live
 * MediaSource is the union of that window and whatever is buffered, and
 * grows behind a paused playhead until it crosses any threshold.
 *
 * Reads happen on the events the video already fires; the live window has
 * no event of its own and moves with the clock, so `timeupdate` covers it.
 * While a pointer holds the thumb, the played layer follows the pointer and
 * `currentTime` is written at most once per frame, so the bar never fights
 * a slow seek.
 *
 * The preview above the pointer carries the time and, when the session's
 * `engine.thumbnails` answers for that time, the tile: a rectangle of a
 * sprite, drawn by background position at the sprite's own size and scaled
 * down to `--mbx-preview-width`, so a page sets the size with one token.
 *
 * On a seekable live stream the time and the preview read the wall clock
 * when `engine.pdt` can say it, "14:23:05", which is what a viewer of a
 * broadcast wants to know; the distance behind the edge otherwise.
 */
import type { ThumbnailsApi } from 'mattebox/stages/thumbnails';
import { el } from '../dom.js';
import type { LiveApi, PdtApi } from '../namespaces.js';
import type { Control, Flag } from './control.js';
import type { Controls } from './options.js';
import type { Span } from './ranges.js';
import { at, clip, EMPTY, fraction, spans, window } from './ranges.js';
import { slider } from './slider.js';
import { clock, describe, format } from './time.js';

/** What the session feeding the video offers the row, each when it has one. */
export interface SeekSource {
  readonly live?: LiveApi | undefined;
  readonly thumbnails?: ThumbnailsApi | undefined;
  readonly pdt?: PdtApi | undefined;
  /** The engine's forward buffer goal in seconds, read when the row decides whether a live window is worth seeking. */
  readonly bufferGoal?: (() => number) | undefined;
  /** The engine's sliding availability window, in presentation time, or null before it opens. */
  readonly window?: (() => Span | null) | undefined;
}

export interface SeekBar extends Control {
  attach(source: SeekSource): void;
  detach(): void;
}

/** What the tile scales down to when the page sets no `--mbx-preview-width`. */
const PREVIEW_WIDTH = 160;

/** The buffer goal assumed for a session that reports none. */
const BUFFER_GOAL = 30;

/** The events on which the row re-reads the video. */
const EVENTS = [
  'timeupdate',
  'progress',
  'durationchange',
  'loadedmetadata',
  'seeking',
  'seeked',
  'emptied',
];

function percent(part: number): string {
  return `${part * 100}%`;
}

export function seekBar(video: HTMLVideoElement, flag: Flag, options: Controls): SeekBar {
  let source: SeekSource = {};
  let span: Span = EMPTY;
  let pending: number | null = null;
  let frame = 0;

  function isLive(): boolean {
    const live = source.live;
    return live !== undefined && live.edge !== null;
  }

  /** The wall clock at a presentation time, when the session can say it. */
  function wall(time: number): string | null {
    const epoch = source.pdt?.toWallClock(time) ?? null;
    return epoch === null ? null : clock(epoch);
  }

  /** What a screen reader hears at a time. */
  function say(time: number): string {
    if (!isLive()) return describe(time, span.end);
    const behind = `${format(span.end - time)} behind live`;
    const at = wall(time);
    return at === null ? behind : `${at}, ${behind}`;
  }

  /** What the preview and the time show at a time. */
  function label(time: number): string {
    if (!isLive()) return format(time);
    return wall(time) ?? `-${format(span.end - time)}`;
  }

  function flush(): void {
    frame = 0;
    if (pending === null) return;
    video.currentTime = pending;
    pending = null;
  }

  const current = el('span', 'current-time', '0:00');
  const duration = el('span', 'duration', '0:00');

  const bar = slider({
    name: 'seek',
    label: 'Seek',
    step: options.seekStep,
    page: options.seekPage,
    onInput(value: number): void {
      bar.set(value, say(value));
      current.textContent = label(value);
      if (!bar.dragging()) {
        // The release, or a key: written now, and it supersedes whatever a
        // frame queued during the drag was about to write.
        pending = null;
        video.currentTime = value;
        return;
      }
      pending = value;
      if (frame === 0) frame = requestAnimationFrame(flush);
    },
  });

  const root = el('div', 'row seek-row');
  root.append(current, bar.root, duration);

  const buffered = el('div', 'buffered seek-buffered');
  const hover = el('div', 'hover seek-hover');
  const edge = el('div', 'edge seek-edge');
  hover.hidden = true;
  edge.hidden = true;
  // Under the fill, so what is played reads over what is buffered.
  bar.track.prepend(buffered);
  bar.track.append(hover, edge);
  const preview = el('div', 'preview seek-preview');
  const image = el('div', 'preview-image seek-preview-image');
  const tile = el('div', 'preview-tile seek-preview-tile');
  const time = el('span', 'preview-time seek-preview-time');
  image.append(tile);
  image.hidden = true;
  preview.append(image, time);
  preview.hidden = true;
  bar.root.append(preview);

  /** The width the page asked for through the token, or the default. */
  function previewWidth(): number {
    const set = Number.parseFloat(
      getComputedStyle(preview).getPropertyValue('--mbx-preview-width'),
    );
    return Number.isFinite(set) && set > 0 ? set : PREVIEW_WIDTH;
  }

  /** The tile for a time, if the track has one, drawn at its size and scaled to fit. */
  function paintTile(when: number): void {
    const found = source.thumbnails?.at(when) ?? null;
    image.hidden = found === null;
    if (found === null) return;
    const scale = previewWidth() / found.width;
    image.style.width = `${found.width * scale}px`;
    image.style.height = `${found.height * scale}px`;
    tile.style.width = `${found.width}px`;
    tile.style.height = `${found.height}px`;
    tile.style.backgroundImage = `url("${found.url}")`;
    tile.style.backgroundPosition = `-${found.x}px -${found.y}px`;
    tile.style.transform = `scale(${scale})`;
  }

  function paintBuffered(): void {
    const parts = clip(spans(video.buffered), span);
    while (buffered.childElementCount > parts.length) buffered.lastElementChild?.remove();
    while (buffered.childElementCount < parts.length) {
      buffered.append(el('div', 'buffered-range seek-buffered-range'));
    }
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
  function worthSeeking(): boolean {
    if (options.liveWindow === 0) return true;
    const goal = source.bufferGoal?.() ?? BUFFER_GOAL;
    return span.end - span.start >= options.liveWindow * goal;
  }

  function tick(): void {
    const on = isLive();
    const own = on ? (source.window?.() ?? null) : null;
    span =
      own !== null && own.end > own.start ? own : window(video.duration, spans(video.seekable), on);
    bar.range(span.start, span.end);
    paintBuffered();
    const live = source.live;
    edge.hidden = !on;
    if (on && live !== undefined && live.edge !== null) {
      edge.style.left = percent(fraction(live.edge, span));
    }
    const seekable = !on || worthSeeking();
    bar.root.hidden = !seekable;
    current.hidden = !seekable;
    duration.hidden = on;
    flag('live', on);
    flag('seekable', seekable);
    if (!on) duration.textContent = format(span.end);
    if (!bar.dragging()) {
      bar.set(video.currentTime, say(video.currentTime));
      current.textContent = label(video.currentTime);
    }
  }

  /** The hover marker and the preview follow the pointer, clamped to the bar. */
  function point(event: PointerEvent): void {
    const rect = bar.rail.getBoundingClientRect();
    if (rect.width === 0 || span.end <= span.start) return;
    const part = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    hover.hidden = false;
    hover.style.left = percent(part);
    preview.hidden = false;
    const when = at(part, span);
    time.textContent = label(when);
    paintTile(when);
    const whole = bar.root.getBoundingClientRect();
    const half = preview.offsetWidth / 2;
    const x = rect.left - whole.left + part * rect.width;
    preview.style.left = `${Math.min(whole.width - half, Math.max(half, x))}px`;
  }

  function leave(): void {
    hover.hidden = true;
    preview.hidden = true;
  }

  bar.root.addEventListener('pointermove', point);
  bar.root.addEventListener('pointerleave', leave);
  for (const name of EVENTS) video.addEventListener(name, tick);
  tick();

  return {
    root,
    attach(found: SeekSource): void {
      source = found;
      tick();
    },
    detach(): void {
      source = {};
      leave();
      tick();
    },
    dispose(): void {
      cancelAnimationFrame(frame);
      bar.root.removeEventListener('pointermove', point);
      bar.root.removeEventListener('pointerleave', leave);
      for (const name of EVENTS) video.removeEventListener(name, tick);
      bar.dispose();
    },
  };
}
