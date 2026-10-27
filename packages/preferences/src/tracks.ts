/**
 * Which track of a new programme matches the one the viewer chose last:
 * the same language and kind scores 3, the same language 2. The same kind
 * alone scores 1 only for audio made for access, an audio description or
 * enhanced speech, which a viewer who needs it keeps over the language.
 * The first track with the highest score wins, and no score keeps the
 * engine's choice.
 */
import type { Track } from 'mattebox';
import { isAudioDescription, isEnhancedSpeech, isSdh } from 'mattebox';
import type { TrackChoice } from './store.js';

/** The kinds a viewer keeps across languages. */
const ACCESS = ['description', 'enhanced-speech'];

/** The primary language subtag, so `de-CH` and `de` are the same language (RFC 5646 §2.2.1). */
function primary(tag: string): string {
  return tag.toLowerCase().split('-')[0] as string;
}

export function score(track: TrackChoice, wanted: TrackChoice): number {
  const language = wanted.language !== '' && primary(track.language) === primary(wanted.language);
  const kind = track.kind === wanted.kind;
  if (language) return kind ? 3 : 2;
  return kind && ACCESS.includes(wanted.kind) ? 1 : 0;
}

/** The index of the best match for `wanted`, or -1 when none scores. `current` wins a tie. */
export function best(tracks: readonly TrackChoice[], wanted: TrackChoice, current = -1): number {
  let found = -1;
  let top = 0;
  tracks.forEach((track, index) => {
    const points = score(track, wanted);
    if (points > top || (points === top && points > 0 && index === current)) {
      found = index;
      top = points;
    }
  });
  return found;
}

/** An engine track as a choice, its kind from the manifest's standard signals. */
export function engineChoice(track: Track): TrackChoice {
  const kind =
    track.contentType === 'text'
      ? isSdh(track)
        ? 'captions'
        : 'subtitles'
      : isAudioDescription(track)
        ? 'description'
        : isEnhancedSpeech(track)
          ? 'enhanced-speech'
          : 'main';
  return { language: track.lang ?? '', kind };
}

/** A native `AudioTrack` or `TextTrack` as a choice, from HTML's kinds. */
export function nativeChoice(track: {
  readonly kind: string;
  readonly language: string;
}): TrackChoice {
  // `main-desc` is a main track with the description mixed in; an empty kind is a plain one.
  const kind = track.kind === 'main-desc' ? 'description' : track.kind || 'main';
  return { language: track.language, kind };
}
