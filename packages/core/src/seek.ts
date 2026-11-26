/**
 * A seek that waits for the video's first frame, where the browser needs
 * that.
 *
 * Apple's WebKit loses a seek made before the first frame of a source it
 * plays itself. Playback then starts at 0, and no later seek moves it, from
 * the controls or from a script: https://bugs.webkit.org/show_bug.cgi?id=261512,
 * open, and reported on iOS 13 to 17. An iPhone loads no frame before the
 * viewer plays, so every seek before play is one of these. Writing
 * `currentTime` before the metadata is no way around it: WebKit keeps the
 * value and seeks when the metadata arrives, which is the same moment.
 *
 * The native handler starts a wait for each source it gives to such a
 * browser. Until `loadeddata`, `seek()` keeps the time and writes nothing,
 * and the last time kept is written once the frame is there. After that,
 * and in every other browser, `seek()` writes `currentTime` at once.
 *
 * The wait is a way around a browser's bug. When WebKit takes the seek,
 * `awaitFirstFrame()` goes, and `seek()` is `video.currentTime = time`.
 */

/** The wait of one source: the time `seek()` kept, or null when it kept none. */
interface Wait {
  time: number | null;
}

/** The videos that wait for their first frame. Made at the first wait, so importing the core makes nothing. */
let waits: WeakMap<HTMLMediaElement, Wait> | undefined;

/**
 * Seeks `video` to `time`. A video that waits for its first frame keeps
 * the time in place of the one before it, and seeks once the frame is
 * there.
 */
export function seek(video: HTMLMediaElement, time: number): void {
  const wait = waits?.get(video);
  if (wait === undefined) video.currentTime = time;
  else wait.time = time;
}

/**
 * The time `video` starts from once it has its first frame: what `seek()`
 * kept. Null when it kept nothing, which is every video that takes its
 * seeks at once.
 */
export function pendingSeek(video: HTMLMediaElement): number | null {
  return waits?.get(video)?.time ?? null;
}

/**
 * Starts the wait for the first frame of the source `video` was just
 * given, where the browser is Apple's WebKit. The vendor string is the one
 * value every WebKit browser shares, without parsing the user agent.
 * Returns the function that ends the wait and drops the time it kept, for
 * a source that goes before its first frame.
 */
export function awaitFirstFrame(video: HTMLMediaElement): () => void {
  if (!navigator.vendor.startsWith('Apple')) return () => undefined;
  const wait: Wait = { time: null };
  const all = waits ?? new WeakMap<HTMLMediaElement, Wait>();
  waits = all;
  all.set(video, wait);
  const end = (): void => {
    video.removeEventListener('loadeddata', first);
    // A later source on the same video has a wait of its own.
    if (all.get(video) === wait) all.delete(video);
  };
  const first = (): void => {
    end();
    if (wait.time !== null) video.currentTime = wait.time;
  };
  video.addEventListener('loadeddata', first);
  return end;
}
