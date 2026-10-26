/**
 * Versions of the picture at their own URLs, such as a sign-language
 * version. A switch is a new load, so the element carries over what the
 * viewer had: the position, the play state, and the audio and subtitle
 * choice. A track inside the manifest needs none of this: the engine
 * switches it in the same session.
 */
import type { Source, SourceVideoTrack } from '@mattebox/player-core';
import type { Mattebox, Track } from 'mattebox';
import { isAudioDescription, isSdh } from 'mattebox';

/** The child element that declares a version in markup, as `<track>` declares text. */
export const VIDEO_TRACK = 'mbx-video-track';

/** The versions the `<mbx-video-track>` children of `element` declare, in their order. */
export function markupVideoTracks(element: Element): SourceVideoTrack[] {
  const found: SourceVideoTrack[] = [];
  for (const child of Array.from(element.children)) {
    const url = child.localName === VIDEO_TRACK ? child.getAttribute('src') : null;
    if (url === null) continue;
    const type = child.getAttribute('type');
    const label = child.getAttribute('label');
    const language = child.getAttribute('srclang');
    found.push({
      url,
      kind: child.getAttribute('kind') ?? 'alternative',
      ...(type === null ? {} : { type }),
      ...(label === null ? {} : { label }),
      ...(language === null ? {} : { language }),
    });
  }
  return found;
}

/** The source a version loads as. Without EME it brings no DRM, as a source does not. */
export function versionSource(track: SourceVideoTrack, eme: boolean): Source {
  return {
    url: track.url,
    ...(track.type === undefined ? {} : { type: track.type }),
    ...(eme && track.drm !== undefined ? { drm: track.drm } : {}),
  };
}

/**
 * Puts the new load where the old one was: the same position, and playing
 * when it played. A position on a live source means nothing on another
 * stream's timeline, so `at` is null there and the load joins at its edge.
 * A load that empties the video before its metadata drops the wait.
 */
export function resume(media: HTMLMediaElement, at: number | null, playing: boolean): void {
  const go = (): void => {
    media.removeEventListener('emptied', drop);
    if (at !== null) media.currentTime = at;
    if (playing) media.play().catch(() => undefined);
  };
  const drop = (): void => {
    media.removeEventListener('loadedmetadata', go);
  };
  if (media.readyState >= 1) {
    go();
    return;
  }
  media.addEventListener('loadedmetadata', go, { once: true });
  media.addEventListener('emptied', drop, { once: true });
}

/** The audio and subtitle tracks a viewer had; text is null when subtitles were off. */
export interface Chosen {
  readonly audio: Track | null;
  readonly text: Track | null;
}

export function chosen(engine: Mattebox | null): Chosen | null {
  if (engine === null) return null;
  return { audio: engine.tracks.active('audio'), text: engine.tracks.active('text') };
}

/** The same language, and the same audio description or SDH flag. */
function same(a: Track, b: Track): boolean {
  return (
    a.lang === b.lang &&
    isAudioDescription(a) === isAudioDescription(b) &&
    isSdh(a) === isSdh(b) &&
    a.forced === b.forced
  );
}

/**
 * Selects on `engine` the tracks that match what the viewer had, once its
 * manifest lists them. A track with no match keeps the engine's default.
 */
export function restore(engine: Mattebox | null, had: Chosen | null): void {
  if (engine === null || had === null) return;
  const apply = (): void => {
    const { available } = engine.tracks;
    for (const [contentType, track] of [
      ['audio', had.audio],
      ['text', had.text],
    ] as const) {
      if (track === null) {
        if (contentType === 'text') engine.tracks.deselect('text');
        continue;
      }
      const match = available.find(
        (t) => t.contentType === contentType && engine.tracks.selectable(t.id) && same(t, track),
      );
      if (match !== undefined) engine.tracks.select(match.id);
    }
  };
  if (engine.tracks.available.length > 0) {
    apply();
    return;
  }
  const off = engine.on('tracks:changed', () => {
    off();
    apply();
  });
}

/**
 * Shows the frame on screen as the poster of `media` while the next load has
 * none: a new load empties the video, which then shows its poster, so the
 * picture would flash to the poster and back. Returns the function that puts
 * the poster back, or null when there is no frame to hold or the canvas
 * cannot export it, as for a video from another origin without CORS.
 */
export function holdFrame(media: HTMLVideoElement): (() => void) | null {
  if (media.readyState < 2 || media.videoWidth === 0) return null;
  const canvas = document.createElement('canvas');
  canvas.width = media.videoWidth;
  canvas.height = media.videoHeight;
  let frame: string;
  try {
    canvas.getContext('2d')?.drawImage(media, 0, 0);
    frame = canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    return null;
  }
  const poster = media.getAttribute('poster');
  media.setAttribute('poster', frame);
  return () => {
    // A poster the page set meanwhile stays.
    if (media.getAttribute('poster') !== frame) return;
    if (poster === null) media.removeAttribute('poster');
    else media.setAttribute('poster', poster);
  };
}

/**
 * Calls `release` once the new load shows a frame where `resume` put it:
 * after the seek to `at`, or on the first frame when it joins a live edge,
 * or when playback starts.
 */
export function onNextFrame(media: HTMLMediaElement, at: number | null, release: () => void): void {
  const events = ['playing', at === null ? 'loadeddata' : 'seeked'];
  const done = (): void => {
    for (const type of events) media.removeEventListener(type, done);
    release();
  };
  for (const type of events) media.addEventListener(type, done);
}
