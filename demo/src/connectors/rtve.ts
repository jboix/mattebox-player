/**
 * RTVE, Spain's public broadcaster, as a connector for `rtve/video`: the id
 * is an RTVE video id, `www.rtve.es/api/videos/{id}.json` describes it, and
 * `ztnr.rtve.es/ztnr/{id}.m3u8` redirects to its HLS stream. Both answer
 * any origin. Its DASH answers 403 to other sites, so the demo takes HLS.
 */
import type { Block, Connector } from '@mattebox/player';
import type { DemoConnector } from './types.js';
import { json } from './types.js';

/** One video of the RTVE API, as far as the demo reads it. */
export interface RtveVideo {
  readonly id: string;
  readonly title: string;
  readonly thumbnail?: string;
  readonly imageSEO?: string;
  readonly programInfo?: { readonly title?: string } | null;
  readonly requireLogged?: boolean;
  readonly allowedInCountry?: boolean;
  readonly geolocalizado?: boolean;
  readonly hasDRM?: boolean;
  readonly paidContent?: boolean;
}

interface RtvePage {
  readonly page: { readonly items: readonly RtveVideo[] };
}

/** Why the video does not play from this page, in RTVE's own terms, or undefined. */
function blockOf(video: RtveVideo): Block | undefined {
  if (video.allowedInCountry === false || video.geolocalizado === true) {
    return {
      message: {
        en: 'This programme is only available in Spain.',
        es: 'Este programa solo está disponible en España.',
      },
    };
  }
  if (video.requireLogged === true || video.paidContent === true) {
    return {
      message: {
        en: 'This programme needs an RTVE Play account.',
        es: 'Este programa requiere una cuenta de RTVE Play.',
      },
    };
  }
  if (video.hasDRM === true) {
    return {
      message: { en: 'This programme is protected, and the demo plays clear streams only.' },
    };
  }
  return undefined;
}

export const rtve: Connector<RtveVideo> = {
  type: 'rtve/video',
  async fetch(id, signal) {
    const data = await json<RtvePage>(
      `https://www.rtve.es/api/videos/${encodeURIComponent(id)}.json`,
      signal,
    );
    const video = data.page.items[0];
    if (video === undefined) throw new Error(`RTVE has no video ${id}`);
    return video;
  },
  resolve(video) {
    const metadata = {
      title: video.title,
      ...(video.programInfo?.title == null ? {} : { subtitle: video.programInfo.title }),
      ...(video.thumbnail === undefined ? {} : { image: video.thumbnail, poster: video.thumbnail }),
    };
    const block = blockOf(video);
    if (block !== undefined) return { sources: [], block, metadata };
    return {
      sources: [
        {
          url: `https://ztnr.rtve.es/ztnr/${video.id}.m3u8`,
          type: 'application/vnd.apple.mpegurl',
        },
      ],
      metadata,
    };
  },
};

export const rtveDemo: DemoConnector = {
  connector: rtve,
  name: 'RTVE',
  placeholder: 'An RTVE video id, such as 17285375',
  async examples(signal) {
    const data = await json<RtvePage>('https://www.rtve.es/api/videos.json?size=30', signal);
    return data.page.items.slice(0, 20).map((video) => {
      const block = blockOf(video);
      return {
        id: video.id,
        title: video.title,
        ...(block === undefined ? {} : { note: 'blocked' }),
      };
    });
  },
};
