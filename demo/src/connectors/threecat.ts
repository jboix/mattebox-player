/**
 * 3Cat, Catalonia's public broadcaster (CCMA, TV3), as a connector for
 * `3cat/video`: the id is a 3Cat video id, or a live channel such as `324` or `tv3`,
 * and `api-media.ccma.cat/pvideo/media.jsp` describes it. The media API
 * and the CDN answer any origin; the catalogue's listings do not, so the
 * demo's list is fixed.
 */
import type { Block, Connector, Source } from '@mattebox/player';
import type { DemoConnector, Example } from './types.js';
import { json } from './types.js';

/** Who may watch a stream, in 3Cat's words: everyone, Spain, or Catalonia. */
type Geo = 'TOTS' | 'ESPANYA' | 'CATALUNYA';

/** What the media API returns, as far as the demo reads it. */
export interface ThreeCatMedia {
  readonly informacio: {
    readonly id: number | string;
    readonly titol?: string;
    readonly programa?: string;
    readonly descripcio?: string;
    readonly estat?: { readonly actiu?: boolean; readonly text?: string };
    /** A live channel's name, such as `324`. */
    readonly nom?: string;
    /** A live channel's programme on air now. */
    readonly despresfem?: { readonly programa?: string; readonly descripcio?: string };
  };
  /**
   * A programme on demand names its geo once, with its files; a live
   * channel is the list of its streams, one per geo.
   */
  readonly media?:
    | readonly Stream[]
    | { readonly geo?: Geo; readonly url?: string | readonly Stream[] }
    | string;
  readonly imatges?: { readonly url?: string };
}

/** One stream or file: a live stream names its URL, its format and its geo, a file its label. */
interface Stream {
  readonly file?: string;
  readonly label?: string;
  readonly geo?: Geo;
  readonly format?: string;
  readonly url?: string;
}

function isList(value: unknown): value is readonly Stream[] {
  return Array.isArray(value);
}

const MEDIA = 'https://api-media.ccma.cat/pvideo/media.jsp';

/** The live channels' names, which the API gives as ids. */
const CHANNELS: Readonly<Record<string, string>> = { '324': '3/24', tv3: 'TV3' };

/** The mime type of a 3Cat label or format. */
function typeOf(label: string | undefined, url: string): string | undefined {
  if (label === 'DASH' || url.endsWith('.mpd')) return 'application/dash+xml';
  if (label === 'HLS' || url.includes('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (url.endsWith('.mp4')) return 'video/mp4';
  return undefined;
}

/** The words for a stream limited to Spain or Catalonia, in Catalan, Spanish and English. */
const LIMITED: Readonly<Record<Exclude<Geo, 'TOTS'>, Block>> = {
  ESPANYA: {
    message: {
      en: 'This programme is only available in Spain.',
      ca: 'Aquest programa només està disponible a Espanya.',
      es: 'Este programa solo está disponible en España.',
    },
  },
  CATALUNYA: {
    message: {
      en: 'This programme is only available in Catalonia.',
      ca: 'Aquest programa només està disponible a Catalunya.',
      es: 'Este programa solo está disponible en Cataluña.',
    },
  },
};

/**
 * The streams everyone may watch, the adaptive one first, or the block
 * when there are none. The page cannot tell where the viewer is, so the
 * demo says the limit rather than show the CDN's refusal as an error.
 */
function streamsOf(media: ThreeCatMedia['media']): { sources: Source[]; block?: Block } {
  if (media === undefined || typeof media === 'string') return { sources: [] };
  const shared = isList(media) ? undefined : media.geo;
  const list = isList(media) ? media : media.url;
  if (typeof list === 'string') {
    if (shared !== undefined && shared !== 'TOTS') return { sources: [], block: LIMITED[shared] };
    // A profile that gives one file gives it over http, which an https page cannot load.
    return { sources: [{ url: list.replace(/^http:/, 'https:'), type: 'video/mp4' }] };
  }
  const entries = list ?? [];
  const geoOf = (entry: Stream): Geo => entry.geo ?? shared ?? 'TOTS';
  const open = entries.filter((entry) => geoOf(entry) === 'TOTS');
  if (open.length === 0) {
    const limited = entries.map(geoOf).find((geo): geo is Exclude<Geo, 'TOTS'> => geo !== 'TOTS');
    return limited === undefined ? { sources: [] } : { sources: [], block: LIMITED[limited] };
  }
  const sources: Source[] = [];
  for (const entry of open) {
    const url = entry.file ?? entry.url;
    if (url === undefined) continue;
    const type = typeOf(entry.label ?? entry.format, url);
    sources.push(type === undefined ? { url } : { url, type });
  }
  // The adaptive stream first, then the files, the largest first as the API lists them.
  const file = (source: Source): boolean => source.type === 'video/mp4';
  return { sources: [...sources.filter((s) => !file(s)), ...sources.filter(file)] };
}

export const threecat: Connector<ThreeCatMedia> = {
  type: '3cat/video',
  fetch(id, signal) {
    // The `pc` profile lists the DASH stream and the files over https.
    const params = new URLSearchParams({
      media: 'video',
      versio: 'vast',
      idint: id,
      profile: 'pc',
      format: 'dm',
    });
    return json<ThreeCatMedia>(`${MEDIA}?${params}`, signal);
  },
  resolve(data) {
    const info = data.informacio;
    const image = data.imatges?.url;
    const live = info.nom === undefined ? undefined : (CHANNELS[info.nom] ?? info.nom);
    const title = info.titol ?? live;
    const subtitle = info.programa ?? info.despresfem?.programa;
    const description = info.descripcio ?? info.despresfem?.descripcio;
    const metadata = {
      ...(title === undefined ? {} : { title }),
      ...(subtitle === undefined ? {} : { subtitle }),
      ...(description === undefined ? {} : { description }),
      ...(image === undefined ? {} : { image, poster: image }),
    };
    if (info.estat?.actiu === false) {
      return {
        sources: [],
        block: {
          message: {
            en: 'This programme is no longer available.',
            ca: info.estat.text ?? 'Aquest programa ja no està disponible.',
          },
        },
        metadata,
      };
    }
    const { sources, block } = streamsOf(data.media);
    return block === undefined ? { sources, metadata } : { sources: [], block, metadata };
  },
};

export const threecatDemo: DemoConnector = {
  connector: threecat,
  name: '3Cat',
  placeholder: 'A 3Cat video id, such as 6431690, or 324',
  // The catalogue's listings answer no other origin: these were picked by
  // hand, all open to every country. TV3 live plays its international
  // feed, the one stream of its three that is not for Spain or Catalonia.
  examples: async (): Promise<readonly Example[]> => [
    { id: '324', title: '3/24', note: 'live, news' },
    { id: 'tv3', title: 'TV3', note: 'live, the international feed' },
    { id: '6431690', title: "Justo Molinero: el poder d'una veu", note: 'documentary' },
    { id: '6357855', title: 'Bruc', note: 'film' },
    { id: '1031449', title: 'Ventdelplà, T6xC45' },
    { id: '1012189', title: 'El cor de la ciutat, T9xC104' },
  ],
};
