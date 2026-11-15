/**
 * The video's sound as a stream, for the recognizer: `captureStream()`.
 *
 * Not Web Audio: `createMediaElementSource` sends the element's sound
 * through an audio context for the rest of its life. A source from another
 * site without CORS then plays as silence, and the page cannot undo it.
 * A capture leaves playback alone. It carries the sound while the video is
 * muted, and it needs no user's gesture.
 *
 * The browser refuses to capture another site's media served without CORS,
 * with a SecurityError, which `capture` returns as null.
 *
 * One capture at a time: in Chromium, a new capture of the same media takes
 * the sound from the one before. Its track stays live and carries silence,
 * whether the new capture's tracks are stopped or not.
 */

/** A new capture of `media`'s sound and picture. Null where the browser refuses it. */
export function capture(media: HTMLMediaElement): MediaStream | null {
  try {
    return (media as HTMLMediaElement & { captureStream(): MediaStream }).captureStream();
  } catch {
    return null;
  }
}

/** Whether this browser captures a media element. */
export function capturable(): boolean {
  return typeof HTMLMediaElement !== 'undefined' && 'captureStream' in HTMLMediaElement.prototype;
}

/** The stream's newest live audio track, or undefined before the media has sound. */
export function audioOf(stream: MediaStream): MediaStreamTrack | undefined {
  return stream
    .getAudioTracks()
    .filter((track) => track.readyState === 'live')
    .pop();
}
