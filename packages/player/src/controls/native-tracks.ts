/**
 * The element's own track lists, for the audio and subtitles menus of a
 * native session. Safari lists the renditions of an HLS stream it plays
 * itself in `audioTracks` and `textTracks`. No engine-shaped object goes
 * over them: the menus read the lists and write `enabled` and `mode`.
 * Each list is feature-tested, so a browser without it keeps the menu hidden.
 */
import type { PlayerHost } from '../host.js';

/** What the menus read of an `AudioTrack` or a `TextTrack`. */
export interface NativeTrack {
  readonly kind: string;
  readonly label: string;
  readonly language: string;
}

/** An `AudioTrackList` or a `TextTrackList`. lib.dom has no `AudioTrackList`. */
export interface NativeTrackList<T extends NativeTrack> extends EventTarget {
  readonly length: number;
  readonly [index: number]: T;
}

/**
 * The video's `audioTracks` or `textTracks` during a native session, or
 * undefined: an engine session has its own tracks, and Chromium has no
 * `audioTracks` without a flag.
 */
export function nativeTracks<T extends NativeTrack>(
  player: PlayerHost,
  name: 'audioTracks' | 'textTracks',
): T[] | undefined {
  const session = player.player?.session;
  if (session == null || session.engine !== null) return undefined;
  const list = (player.video as unknown as Record<string, NativeTrackList<T> | undefined>)[name];
  return list === undefined ? undefined : Array.from(list);
}

/** Calls `tick` when the video's list of `name` changes, and answers the unsubscribe. */
export function onNativeTracks(
  video: HTMLVideoElement,
  name: 'audioTracks' | 'textTracks',
  tick: () => void,
): (() => void) | undefined {
  const list = (video as unknown as Record<string, EventTarget | undefined>)[name];
  if (list === undefined) return undefined;
  const events = ['change', 'addtrack', 'removetrack'];
  for (const event of events) list.addEventListener(event, tick);
  return () => {
    for (const event of events) list.removeEventListener(event, tick);
  };
}

/** The label the stream gave, else the language, else the place in the list. */
export function nativeLabel(track: NativeTrack, index: number): string {
  return track.label || track.language || String(index + 1);
}
