/**
 * Chapters come from one of two places, read through these helpers so the
 * seek bar and the chapters menu agree without knowing each other.
 *
 * - The engine's `chapters` namespace, when the session has one and it
 *   holds chapters: a file the player's `chapters` attribute loaded, the
 *   manifest's own, or chapters the page set. See the engine guide's
 *   chapters chapter.
 * - Otherwise the browser's own: a text track of kind `chapters` on the
 *   video, from a `<track>` the page or the player's `chapters` attribute
 *   put there, or from `addTextTrack`. A native session has chapters this
 *   way.
 *
 * A track from a `<track>` element loads its cues only while its mode is
 * `hidden` or `showing`, so a disabled chapters track is set hidden here:
 * hidden draws nothing, and the cues arrive.
 */
import type { Mattebox } from 'mattebox';
import type { PlayerHost } from '../host.js';
import { optional } from './session.js';

export interface Chapter {
  readonly start: number;
  readonly end: number;
  readonly title: string;
  /** The URL of the chapter's picture. Only the engine's chapters carry one. */
  readonly image?: string;
}

/** The first chapters track on the video, or null. */
export function chapterTrack(video: HTMLVideoElement): TextTrack | null {
  for (const track of video.textTracks) if (track.kind === 'chapters') return track;
  return null;
}

/** The engine's chapters, already in order, or none. */
function engineChapters(engine: Mattebox | null): Chapter[] {
  const api = optional(engine).chapters;
  if (api === undefined) return [];
  return api.all.map((chapter) => ({
    start: chapter.start,
    end: chapter.end,
    title: chapter.title,
    ...(chapter.image === undefined ? {} : { image: chapter.image.url }),
  }));
}

/** The cues of the video's chapters track, in order, or none. */
function trackChapters(video: HTMLVideoElement): Chapter[] {
  const track = chapterTrack(video);
  if (track === null || track.cues === null) return [];
  const out: Chapter[] = [];
  for (const cue of track.cues) {
    const text = cue instanceof VTTCue ? cue.text : '';
    out.push({ start: cue.startTime, end: cue.endTime, title: text.trim() });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** The chapters of the session: the engine's when it holds some, else the video's track. */
export function chapters(video: HTMLVideoElement, engine: Mattebox | null): Chapter[] {
  const own = engineChapters(engine);
  return own.length > 0 ? own : trackChapters(video);
}

/** The index of the chapter `time` falls in, the last one started, or -1 before the first. */
export function chapterAt(list: readonly Chapter[], time: number): number {
  let found = -1;
  for (const [i, chapter] of list.entries()) if (chapter.start <= time) found = i;
  return found;
}

/**
 * Runs `fn` whenever the chapters may have changed: the engine reported a
 * change, a session came in, a track was added or removed, the cues of a
 * `<track>` arrived, or the active cue moved on. Returns the unsubscribe.
 * Every chapters track found is set hidden, so its cues load.
 */
export function followChapters(player: PlayerHost, fn: () => void): () => void {
  const video = player.video;
  const listen = (target: EventTarget, name: string, handler: () => void): (() => void) => {
    target.addEventListener(name, handler);
    return () => {
      target.removeEventListener(name, handler);
    };
  };
  /** The listeners on the tracks of the moment, replaced when the list changes. */
  let inner: Array<() => void> = [];
  /** The listener on the engine of the moment, replaced when the session changes. */
  let own: () => void = () => undefined;
  const wire = (): void => {
    for (const off of inner) off();
    inner = [];
    for (const track of video.textTracks) {
      if (track.kind !== 'chapters') continue;
      if (track.mode === 'disabled') track.mode = 'hidden';
      inner.push(listen(track, 'cuechange', fn));
    }
    for (const node of video.querySelectorAll('track')) {
      if (node.kind === 'chapters') inner.push(listen(node, 'load', fn));
    }
    fn();
  };
  const session = (): void => {
    own();
    own = player.engine?.on('chapters:changed', fn) ?? (() => undefined);
    fn();
  };
  const outer = [
    listen(video.textTracks, 'addtrack', wire),
    listen(video.textTracks, 'removetrack', wire),
    listen(player, 'sourcechange', session),
  ];
  wire();
  session();
  return () => {
    for (const off of [...outer, ...inner]) off();
    own();
    inner = [];
  };
}
