/**
 * Chapters are the browser's own: a text track of kind `chapters` on the
 * video, from a `<track>` the page or the player's `chapters` attribute put
 * there, or from `addTextTrack`. The seek bar and the chapters menu read the
 * same track through these helpers, so the two agree without knowing each
 * other, and a native session has chapters the same way.
 *
 * A track from a `<track>` element loads its cues only while its mode is
 * `hidden` or `showing`, so a disabled chapters track is set hidden here:
 * hidden draws nothing, and the cues arrive.
 */

export interface Chapter {
  readonly start: number;
  readonly end: number;
  readonly title: string;
}

/** The first chapters track on the video, or null. */
export function chapterTrack(video: HTMLVideoElement): TextTrack | null {
  for (const track of video.textTracks) if (track.kind === 'chapters') return track;
  return null;
}

/** The chapters of the video, in order, or none. */
export function chapters(video: HTMLVideoElement): Chapter[] {
  const track = chapterTrack(video);
  if (track === null || track.cues === null) return [];
  const out: Chapter[] = [];
  for (const cue of track.cues) {
    const text = cue instanceof VTTCue ? cue.text : '';
    out.push({ start: cue.startTime, end: cue.endTime, title: text.trim() });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** The index of the chapter `time` falls in, the last one started, or -1 before the first. */
export function chapterAt(list: readonly Chapter[], time: number): number {
  let found = -1;
  for (const [i, chapter] of list.entries()) if (chapter.start <= time) found = i;
  return found;
}

/**
 * Runs `fn` whenever the chapters may have changed: a track added or removed,
 * the cues of a `<track>` arriving, or the active cue moving on. Returns
 * the unsubscribe. Every chapters track found is set hidden, so its cues load.
 */
export function followChapters(video: HTMLVideoElement, fn: () => void): () => void {
  const listen = (target: EventTarget, name: string, handler: () => void): (() => void) => {
    target.addEventListener(name, handler);
    return () => {
      target.removeEventListener(name, handler);
    };
  };
  /** The listeners on the tracks of the moment, replaced when the list changes. */
  let inner: Array<() => void> = [];
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
  const outer = [
    listen(video.textTracks, 'addtrack', wire),
    listen(video.textTracks, 'removetrack', wire),
  ];
  wire();
  return () => {
    for (const off of [...outer, ...inner]) off();
    inner = [];
  };
}
