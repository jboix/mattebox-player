/**
 * Markers: ranges of the media a page names, such as the opening and
 * closing credits, and ranges that must not play, such as a part blocked
 * for legal reasons. No stream format carries credits as a standard, so a
 * page sets them from its own content API. They work on the video, which
 * every session has, so an engine session and a native one behave alike.
 *
 * A blocked range is never played: entering it, by playback or by a seek,
 * moves the playhead to its end.
 */
import type { Marker } from '@mattebox/player-core';

export type { Marker };

export interface Markers {
  /** The markers of the current source, by start. */
  readonly list: readonly Marker[];
  /** Replaces the markers. A new source clears them. */
  set(list: readonly Marker[]): void;
  /** The markers that hold `time`. */
  within(time: number): readonly Marker[];
}

/**
 * Past a blocked range's end by this much, so the playhead does not settle
 * on the end itself and enter the range again: Safari can report a time a
 * hair before the one it was given.
 */
const PAST = 0.1;

/**
 * Markers over `video`. `emit` reports a change of the list as
 * `markerschange` and a jump over a blocked range as `blocked`.
 */
export function createMarkers(
  video: HTMLVideoElement,
  emit: (name: string, detail: unknown) => void,
): Markers {
  let list: readonly Marker[] = [];

  const within = (time: number): readonly Marker[] =>
    list.filter((marker) => marker.start <= time && time < marker.end);

  const guard = (): void => {
    const blocked = within(video.currentTime).find((marker) => marker.kind === 'blocked');
    if (blocked === undefined) return;
    video.currentTime = Math.min(blocked.end + PAST, video.duration || Number.POSITIVE_INFINITY);
    emit('blocked', blocked);
  };
  video.addEventListener('seeking', guard);
  video.addEventListener('timeupdate', guard);

  return {
    get list() {
      return list;
    },
    set(next) {
      list = [...next].sort((a, b) => a.start - b.start);
      emit('markerschange', list);
      guard();
    },
    within,
  };
}
