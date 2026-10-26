import type { Mattebox, Track } from 'mattebox';
import { describe, expect, it } from 'vitest';
import { chosen, holdFrame, onNextFrame, restore, versionSource } from '../../src/video-sources.js';

const AD = ['public.accessibility.describes-video'];

function track(id: string, contentType: Track['contentType'], extra: Partial<Track> = {}): Track {
  return { id, contentType, mimeType: '', protection: null, renditions: [], ...extra };
}

/** An engine with `available` tracks, that records what is selected and when it lists them. */
function engine(available: Track[], active: Record<string, string | null> = {}) {
  const listeners: Array<() => void> = [];
  const picked: string[] = [];
  const fake = {
    picked,
    list(tracks: Track[]): void {
      available.splice(0, available.length, ...tracks);
      for (const fn of listeners.splice(0)) fn();
    },
    on: (_name: string, fn: () => void) => {
      listeners.push(fn);
      return () => undefined;
    },
    tracks: {
      available,
      active: (type: string) => available.find((t) => t.id === active[type]) ?? null,
      selectable: () => true,
      select: (id: string) => picked.push(id),
      deselect: (type: string) => picked.push(`off:${type}`),
    },
  };
  return fake as unknown as Mattebox & typeof fake;
}

describe('the choice a version carries over', () => {
  it('selects the same audio language and description, and the same subtitles', () => {
    const before = engine(
      [
        track('a-de-ad', 'audio', { lang: 'de', characteristics: AD }),
        track('t-fr', 'text', { lang: 'fr' }),
      ],
      { audio: 'a-de-ad', text: 't-fr' },
    );
    const after = engine([]);
    restore(after, chosen(before));
    // Nothing yet: the version's manifest lists its tracks later.
    expect(after.picked).toEqual([]);
    after.list([
      track('de', 'audio', { lang: 'de' }),
      track('de-ad', 'audio', { lang: 'de', characteristics: AD }),
      track('fr-forced', 'text', { lang: 'fr', forced: true }),
      track('fr', 'text', { lang: 'fr' }),
    ]);
    expect(after.picked).toEqual(['de-ad', 'fr']);
  });

  it('turns subtitles off when they were, and keeps the default without a match', () => {
    const before = engine([track('a-it', 'audio', { lang: 'it' })], { audio: 'a-it' });
    const after = engine([track('de', 'audio', { lang: 'de' })]);
    restore(after, chosen(before));
    expect(after.picked).toEqual(['off:text']);
  });
});

describe('the source of a version', () => {
  const sign = {
    url: 'https://cdn.test/sign.mpd',
    type: 'application/dash+xml',
    kind: 'sign',
    drm: { licenseUrl: 'https://license.test' },
  };

  it('keeps the URL, the type and the DRM', () => {
    expect(versionSource(sign, true)).toEqual({
      url: 'https://cdn.test/sign.mpd',
      type: 'application/dash+xml',
      drm: { licenseUrl: 'https://license.test' },
    });
  });

  it('leaves the DRM out without EME, as for a source', () => {
    expect(versionSource(sign, false)).toEqual({
      url: 'https://cdn.test/sign.mpd',
      type: 'application/dash+xml',
    });
  });
});

describe('the frame held over a switch', () => {
  it('is let go after the seek to the old place, or once playback starts', () => {
    const media = new EventTarget() as HTMLMediaElement;
    let released = 0;
    onNextFrame(media, 12, () => released++);
    media.dispatchEvent(new Event('loadeddata'));
    expect(released).toBe(0);
    media.dispatchEvent(new Event('seeked'));
    media.dispatchEvent(new Event('playing'));
    expect(released).toBe(1);
  });

  it('is let go on the first frame at a live edge, where there is no seek', () => {
    const media = new EventTarget() as HTMLMediaElement;
    let released = 0;
    onNextFrame(media, null, () => released++);
    media.dispatchEvent(new Event('loadeddata'));
    expect(released).toBe(1);
  });

  it('is not taken before the video has a frame', () => {
    const media = { readyState: 1, videoWidth: 0 } as HTMLVideoElement;
    expect(holdFrame(media)).toBeNull();
  });
});
