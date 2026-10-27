/**
 * DW, Germany's international broadcaster, as a connector for `dw/video`:
 * the id is a DW video id, which `api.dw.com/api/detail/video/{id}`
 * describes with an HLS stream and MP4 files, or `live` for the English
 * channel, whose HLS carries English subtitles. Both answer any origin.
 */
import type { Connector, Source } from '@mattebox/player';
import type { DemoConnector } from './types.js';
import { json } from './types.js';

/** DW's live channel in English. The API lists no live channels, so the URL is fixed. */
const LIVE = 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8';

/** A DW video, as far as the demo reads it, or the live channel. */
export type DwVideo =
  | { readonly live: true }
  | {
      readonly live?: false;
      readonly name: string;
      readonly teaser?: string;
      readonly categoryName?: string;
      readonly mainContent: {
        readonly sources: ReadonlyArray<{
          readonly format: string;
          readonly url: string;
          readonly bitrate: number;
        }>;
        readonly previewImage?: {
          readonly sizes?: ReadonlyArray<{ readonly width: number; readonly url: string }>;
        };
      };
    };

export const dw: Connector<DwVideo> = {
  type: 'dw/video',
  fetch: (id, signal) =>
    id === 'live'
      ? Promise.resolve({ live: true })
      : json<DwVideo>(`https://api.dw.com/api/detail/video/${encodeURIComponent(id)}`, signal),
  resolve(video) {
    if (video.live === true) {
      return {
        sources: [{ url: LIVE, type: 'application/vnd.apple.mpegurl' }],
        metadata: { title: 'DW English', subtitle: 'Live' },
      };
    }
    const content = video.mainContent;
    const hls = content.sources.filter((source) => source.format === 'HLS');
    // The files, the largest first, for a browser that plays neither the engine nor HLS.
    const files = content.sources
      .filter((source) => source.format === 'mp4')
      .sort((a, b) => b.bitrate - a.bitrate);
    const sources: Source[] = [
      ...hls.map((source) => ({ url: source.url, type: 'application/vnd.apple.mpegurl' })),
      ...files.map((source) => ({ url: source.url, type: 'video/mp4' })),
    ];
    const sizes = content.previewImage?.sizes ?? [];
    const image = sizes[sizes.length - 1]?.url;
    return {
      sources,
      metadata: {
        title: video.name.trim(),
        ...(video.categoryName === undefined ? {} : { subtitle: `DW ${video.categoryName}` }),
        ...(video.teaser === undefined ? {} : { description: video.teaser }),
        ...(image === undefined ? {} : { image, poster: image }),
      },
    };
  },
};

interface DwList {
  readonly items: ReadonlyArray<{
    readonly type: string;
    readonly id?: number;
    readonly name: string;
  }>;
}

export const dwDemo: DemoConnector = {
  connector: dw,
  name: 'DW',
  placeholder: 'A DW video id, or live',
  async examples(signal) {
    const data = await json<DwList>(
      'https://api.dw.com/api/list/mediacenter/2?pageIndex=1',
      signal,
    );
    const videos = data.items
      .filter((item) => item.type === 'VideoTeaser' && item.id !== undefined)
      .slice(0, 19)
      .map((item) => ({ id: String(item.id), title: item.name.trim() }));
    return [{ id: 'live', title: 'DW English', note: 'live, subtitles' }, ...videos];
  },
};
