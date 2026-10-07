import type { Rendition } from 'mattebox';
import { describe, expect, it } from 'vitest';
import { qualityLabels, qualityNames } from '../../src/controls/quality-names.js';

/** A video rendition: height, frame rate, peak and average bitrate, codecs. */
function v(
  id: string,
  height: number | undefined,
  bitrate: number,
  extra: Partial<Rendition> = {},
): Rendition {
  return {
    id,
    bitrate,
    codecs: 'avc1.640028',
    mimeType: 'video/mp4',
    segments: [],
    ...(height === undefined ? {} : { height, width: Math.round((height * 16) / 9) }),
    ...extra,
  };
}

const labels = (renditions: Rendition[]) => qualityNames(renditions).map(([, label]) => label);

describe('quality names', () => {
  it('is the height alone while it tells the entries apart', () => {
    expect(labels([v('a', 360, 900_000), v('b', 1080, 5_000_000), v('c', 720, 3_000_000)])).toEqual(
      ['1080p', '720p', '360p'],
    );
  });

  it('adds the frame rate above 30, rounded', () => {
    const fps = (frameRate: number) => ({ frameRate });
    expect(
      labels([
        v('a', 1080, 6_000_000, fps(59.94)),
        v('b', 720, 3_000_000, fps(50)),
        v('c', 540, 2_000_000, fps(29.97)),
        v('d', 360, 900_000, fps(25)),
      ]),
    ).toEqual(['1080p60', '720p50', '540p', '360p']);
  });

  it('names Dolby Vision, from the codec or its supplemental layer, and HDR', () => {
    expect(
      labels([
        v('sdr', 1080, 4_000_000),
        v('pq', 1080, 5_000_000, { codecs: 'hvc1.2.4.L123.B0', videoRange: 'PQ' }),
        v('dv', 1080, 6_000_000, {
          codecs: 'hvc1.2.4.L123.B0',
          supplementalCodecs: 'dvh1.08.07/db4h',
          videoRange: 'HLG',
        }),
        v('dvhe', 720, 3_000_000, { codecs: 'dvhe.05.06', videoRange: 'PQ' }),
      ]),
    ).toEqual(['1080p Dolby Vision', '1080p HDR', '1080p', '720p Dolby Vision']);
  });

  it('adds the average bitrate only where two entries read the same', () => {
    expect(
      labels([
        v('a', 1080, 8_001_098, { frameRate: 60, averageBitrate: 7_968_416 }),
        v('b', 1080, 6_312_875, { frameRate: 60, averageBitrate: 6_170_000 }),
        v('c', 720, 3_216_424, { frameRate: 60, averageBitrate: 3_168_702 }),
        v('d', 360, 541_052),
        v('e', 360, 252_000),
      ]),
    ).toEqual([
      '1080p60 · 8.0 Mbps',
      '1080p60 · 6.2 Mbps',
      '720p60',
      '360p · 541 kbps',
      '360p · 252 kbps',
    ]);
  });

  it('adds the codec where the bitrate still does not tell them apart', () => {
    expect(
      labels([
        v('avc', 1080, 6_100_000),
        v('hevc', 1080, 6_100_000, { codecs: 'hvc1.2.4.L123.B0' }),
        v('low', 1080, 3_400_000, { codecs: 'hvc1.2.4.L123.B0' }),
      ]),
    ).toEqual(['1080p · 6.1 Mbps · H.264', '1080p · 6.1 Mbps · HEVC', '1080p · 3.4 Mbps']);
  });

  it('shows once what reads the same after every step, keeping the first', () => {
    expect(
      qualityNames([
        v('cdn-a', 720, 3_000_000),
        v('cdn-b', 720, 3_000_000),
        v('low', 360, 800_000),
      ]),
    ).toEqual([
      ['cdn-a', '720p'],
      ['low', '360p'],
    ]);
  });

  it('falls back to the bitrate without a height', () => {
    expect(labels([v('a', undefined, 128_000), v('b', undefined, 2_500_000)])).toEqual([
      '2.5 Mbps',
      '128 kbps',
    ]);
  });

  it('labels every rendition, twins included, for a lookup by id', () => {
    expect(qualityLabels([v('cdn-a', 720, 3_000_000), v('cdn-b', 720, 3_000_000)])).toEqual([
      ['cdn-a', '720p'],
      ['cdn-b', '720p'],
    ]);
  });
});
