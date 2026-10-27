/**
 * SVT, Sweden's public broadcaster, as a connector for `svt/video`: the id
 * is an SVT id such as `KXv1QDQ`, and `api.svt.se/video/{id}` describes it
 * with its HLS and DASH references. The API and the CDN answer any origin.
 */
import type { Connector, Source } from '@mattebox/player';
import type { DemoConnector, Example } from './types.js';
import { json } from './types.js';

/** What `api.svt.se/video/{id}` returns, as far as the demo reads it. */
export interface SvtVideo {
  readonly svtId: string;
  readonly programTitle?: string;
  readonly episodeTitle?: string;
  readonly live: boolean;
  readonly rights?: { readonly geoBlockedSweden?: boolean };
  readonly videoReferences?: ReadonlyArray<{ readonly format: string; readonly url: string }>;
  /** The first frame, as a picture. */
  readonly firstFrame?: string;
  /** SVT's audience measurement labels, which a tracker maps. */
  readonly mmsStatistics?: Readonly<Record<string, unknown>>;
}

/** The references the player takes, in the order it tries them: HLS plays natively on Safari too. */
const FORMATS: ReadonlyArray<readonly [string, string]> = [
  ['hls', 'application/vnd.apple.mpegurl'],
  ['dash', 'application/dash+xml'],
];

export const svt: Connector<SvtVideo> = {
  type: 'svt/video',
  fetch: (id, signal) =>
    json<SvtVideo>(`https://api.svt.se/video/${encodeURIComponent(id)}`, signal),
  resolve(video) {
    const metadata = {
      ...(video.programTitle === undefined ? {} : { title: video.programTitle }),
      ...(video.episodeTitle === undefined ? {} : { subtitle: video.episodeTitle }),
      ...(video.firstFrame === undefined
        ? {}
        : { image: video.firstFrame, poster: video.firstFrame }),
    };
    // The flag says the title is for Sweden only, not where the viewer is.
    // The page cannot tell, so the demo says it over the picture rather
    // than show the CDN's refusal as an error.
    if (video.rights?.geoBlockedSweden === true) {
      return {
        sources: [],
        block: {
          message: {
            en: 'This programme is only available in Sweden.',
            sv: 'Programmet är bara tillgängligt i Sverige.',
          },
        },
        metadata,
      };
    }
    const sources: Source[] = [];
    for (const [format, type] of FORMATS) {
      const reference = video.videoReferences?.find((entry) => entry.format === format);
      if (reference !== undefined) sources.push({ url: reference.url, type });
    }
    return { sources, metadata };
  },
};

export const svtDemo: DemoConnector = {
  connector: svt,
  name: 'SVT',
  placeholder: 'An SVT id, such as KXv1QDQ',
  // SVT Play's listings are not open to other origins: these were picked by hand.
  examples: async (): Promise<readonly Example[]> => [
    { id: 'KXv1QDQ', title: 'Ekonomibyrån' },
    { id: 'jXyBJnG', title: 'Budapest brinner' },
    { id: '8qPA6ND', title: 'SVT Nyheter Direkt', note: 'news' },
    { id: 'ch-svt1', title: 'SVT1', note: 'live, Sweden only' },
  ],
};
