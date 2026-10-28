/**
 * SRG SSR content through the integration layer (IL), as a connector for
 * `srgssr/urn`: `fetch` gets the media composition of a URN, and `resolve`
 * turns it into sources, with the Akamai token each resource needs, and
 * the title, chapters, credits and block reason. Demo code only: the
 * element never knows where a URL came from. Adapted from the engine's
 * playground, itself adapted from pillarbox-web.
 */

import type { Block, Connector, Marker, ProgrammeMetadata, Source, Text } from '@mattebox/player';
import type { ChapterInput } from 'mattebox/stages/chapters';
import type { DrmCapability } from './drm-support.js';
import { capabilityParameter, drmCapabilities } from './drm-support.js';
import type { DemoConnector } from './types.js';

const IL_HOST = 'il.srgssr.ch';
export const BUSINESS_UNITS = ['srf', 'rts', 'rsi', 'rtr', 'swi'] as const;
export type BusinessUnit = (typeof BUSINESS_UNITS)[number];

const TOKEN_SERVER = 'https://tp.srgssr.ch/akahd/token?acl=';

export interface SearchResult {
  readonly title: string;
  readonly urn: string;
  readonly mediaType: string;
  readonly date: string;
  /** Milliseconds. */
  readonly duration: number;
  /** The picture is taller than wide, 9:16: a reel. */
  readonly upright: boolean;
}

interface DrmEntry {
  readonly type: 'WIDEVINE' | 'PLAYREADY' | 'FAIRPLAY';
  readonly licenseUrl: string;
  /** FairPlay only: the application certificate. */
  readonly certificateUrl?: string;
}

/** One playable resource of a chapter, as the IL describes it. */
export interface IlResource {
  readonly url: string;
  readonly streaming: string;
  readonly quality: string;
  readonly presentation: string;
  readonly mimeType: string;
  readonly mediaContainer?: string;
  readonly dvr?: boolean;
  readonly live?: boolean;
  readonly tokenType?: string;
  readonly drmList?: readonly DrmEntry[];
}

/** One chapter of a media composition, as the IL describes it. */
export interface IlChapter {
  readonly urn: string;
  readonly title: string;
  readonly type?: string;
  readonly mediaType?: string;
  readonly imageUrl?: string;
  readonly fullLengthUrn?: string;
  /** Milliseconds into the full-length media. */
  readonly fullLengthMarkIn?: number;
  readonly fullLengthMarkOut?: number;
  readonly resourceList?: IlResource[];
  /** Why the chapter does not play, such as `GEOBLOCK` or `STARTDATE`. */
  readonly blockReason?: string;
  /** Opening and closing credits, in milliseconds. */
  readonly timeIntervalList?: ReadonlyArray<{
    readonly type: string;
    readonly markIn: number;
    readonly markOut: number;
  }>;
  /** The Commanders Act labels of the chapter, which a tracker maps. */
  readonly analyticsMetadata?: Readonly<Record<string, string>>;
  /** Parts of the chapter; one with a `blockReason` must not play. */
  readonly segmentList?: ReadonlyArray<{
    readonly markIn: number;
    readonly markOut: number;
    readonly blockReason?: string;
  }>;
}

/**
 * The chapters of the main chapter, the way pillarbox-web reads them: only
 * a video episode has any, and they are the chapters that point into it
 * with the same media type. The IL times are milliseconds into the
 * full-length media; the engine takes seconds.
 */
function chaptersOf(main: IlChapter, list: readonly IlChapter[]): ChapterInput[] {
  if (main.type !== 'EPISODE' || main.mediaType === 'AUDIO') return [];
  const out: ChapterInput[] = [];
  for (const chapter of list) {
    if (chapter.fullLengthUrn !== main.urn || chapter.mediaType !== main.mediaType) continue;
    if (chapter.fullLengthMarkIn === undefined) continue;
    out.push({
      id: chapter.urn,
      start: chapter.fullLengthMarkIn / 1000,
      ...(chapter.fullLengthMarkOut === undefined ? {} : { end: chapter.fullLengthMarkOut / 1000 }),
      title: chapter.title,
      // The IL image service scales on request; the menu draws 64 pixels wide.
      ...(chapter.imageUrl === undefined
        ? {}
        : { image: { url: `${chapter.imageUrl}?width=160&format=jpg` } }),
      data: { urn: chapter.urn },
    });
  }
  return out;
}

/**
 * Why a chapter or a segment does not play, by the IL's block reason, in
 * the four languages of SRG SSR. The player shows them in its own language:
 * over the picture for a chapter, in the seek bar's preview for a segment.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
const BLOCKED: Readonly<Record<string, Text>> = {
  GEOBLOCK: {
    en: 'This content is not available outside Switzerland.',
    de: 'Dieser Inhalt ist ausserhalb der Schweiz nicht verfügbar.',
    fr: 'Ce contenu n’est pas disponible hors de Suisse.',
    it: 'Questo contenuto non è disponibile fuori dalla Svizzera.',
  },
  LEGAL: {
    en: 'This content is not available for legal reasons.',
    de: 'Dieser Inhalt ist aus rechtlichen Gründen nicht verfügbar.',
    fr: 'Ce contenu n’est pas disponible pour des raisons juridiques.',
    it: 'Questo contenuto non è disponibile per motivi legali.',
  },
  COMMERCIAL: {
    en: 'This commercial content is not available.',
    de: 'Dieser kommerzielle Inhalt ist nicht verfügbar.',
    fr: 'Ce contenu commercial n’est pas disponible.',
    it: 'Questo contenuto commerciale non è disponibile.',
  },
  STARTDATE: {
    en: 'This content is not available yet.',
    de: 'Dieser Inhalt ist noch nicht verfügbar.',
    fr: 'Ce contenu n’est pas encore disponible.',
    it: 'Questo contenuto non è ancora disponibile.',
  },
  ENDDATE: {
    en: 'This content is no longer available.',
    de: 'Dieser Inhalt ist nicht mehr verfügbar.',
    fr: 'Ce contenu n’est plus disponible.',
    it: 'Questo contenuto non è più disponibile.',
  },
  AGERATING18: {
    en: 'To protect young viewers, this content is available only between 11 pm and 5 am.',
    de: 'Zum Schutz von Minderjährigen ist dieser Inhalt nur zwischen 23 und 5 Uhr verfügbar.',
    fr: 'Pour protéger les mineurs, ce contenu est disponible uniquement entre 23 h et 5 h.',
    it: 'Per proteggere i minori, questo contenuto è disponibile solo tra le 23 e le 5.',
  },
  AGERATING12: {
    en: 'To protect young viewers, this content is available only between 8 pm and 6 am.',
    de: 'Zum Schutz von Minderjährigen ist dieser Inhalt nur zwischen 20 und 6 Uhr verfügbar.',
    fr: 'Pour protéger les mineurs, ce contenu est disponible uniquement entre 20 h et 6 h.',
    it: 'Per proteggere i minori, questo contenuto è disponibile solo tra le 20 e le 6.',
  },
};

/** Why a protected programme does not play in a browser without its key systems. Machine-drafted. */
const NO_KEY_SYSTEM: Text = {
  en: 'This browser cannot play this protected content.',
  de: 'Dieser Browser kann diesen geschützten Inhalt nicht abspielen.',
  fr: 'Ce navigateur ne peut pas lire ce contenu protégé.',
  it: 'Questo browser non può riprodurre questo contenuto protetto.',
};

/** The words of a block reason: an unknown one gets the player's own "Not available". */
function blockOf(reason: string): Block {
  const message = BLOCKED[reason];
  return message === undefined ? {} : { message };
}

/**
 * The credits and the blocked segments of the main chapter as player
 * markers. The IL times are milliseconds.
 */
function markersOf(main: IlChapter): Marker[] {
  const credits = (main.timeIntervalList ?? []).map((interval) => ({
    start: interval.markIn / 1000,
    end: interval.markOut / 1000,
    kind: interval.type === 'OPENING_CREDITS' ? 'opening-credits' : 'closing-credits',
  }));
  const blocked = (main.segmentList ?? [])
    .filter((segment) => segment.blockReason !== undefined)
    .map((segment) => {
      // Without words of its own, the preview says the player's "Not available".
      const label = BLOCKED[segment.blockReason as string];
      return {
        start: segment.markIn / 1000,
        end: segment.markOut / 1000,
        kind: 'blocked',
        ...(label === undefined ? {} : { label }),
      };
    });
  return [...credits, ...blocked];
}

export async function searchMedia(
  bu: BusinessUnit,
  query: string,
  signal: AbortSignal,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    vector: 'srgplay',
    includeAggregations: 'false',
    includeSuggestions: 'false',
    sortBy: 'default',
    sortDir: 'desc',
    pageSize: '20',
    q: query,
  });
  const url = `https://${IL_HOST}/integrationlayer/2.0/${bu}/searchResultMediaList?${params}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`search failed: HTTP ${response.status}`);
  const data = (await response.json()) as {
    searchResultMediaList?: Array<Omit<SearchResult, 'upright'> & { aspectRatio?: string }>;
  };
  return (data.searchResultMediaList ?? []).map(
    ({ title, urn, mediaType, date, duration, aspectRatio }) => ({
      title,
      urn,
      mediaType,
      date,
      duration,
      upright: aspectRatio === '9:16',
    }),
  );
}

/** The IL's media composition of a URN, as `fetch` returns it and as a page can inject it. */
export interface IlComposition {
  readonly chapterUrn: string;
  readonly chapterList?: readonly IlChapter[];
}

/** The main chapter: the one the URN names. */
export function mainChapter(data: IlComposition): IlChapter {
  const chapter = data.chapterList?.find((c) => c.urn === data.chapterUrn);
  if (chapter === undefined) throw new Error('media composition has no main chapter');
  return chapter;
}

/** The key system the engine takes for each IL vendor. */
const KEY_SYSTEMS: Readonly<Record<DrmEntry['type'], string>> = {
  WIDEVINE: 'com.widevine.alpha',
  PLAYREADY: 'com.microsoft.playready',
  FAIRPLAY: 'com.apple.fps',
};

/**
 * One resource as a source: the token added, and a license server for each
 * of its key systems the browser granted, so the engine finds one for the
 * key system it opens.
 */
async function sourceOf(
  resource: IlResource,
  granted: readonly DrmCapability[],
  signal: AbortSignal,
): Promise<Source | null> {
  // A progressive file, such as an MP3 or an MP4, plays through the browser.
  if (!['HLS', 'DASH', 'PROGRESSIVE'].includes(resource.streaming)) return null;
  const entries = (resource.drmList ?? []).filter((entry) =>
    granted.some((capability) => capability.vendor === entry.type),
  );
  // An encrypted resource without one of this browser's key systems does not play here.
  if ((resource.drmList?.length ?? 0) > 0 && entries.length === 0) return null;
  const url = resource.tokenType === 'AKAMAI' ? await tokenize(resource.url, signal) : resource.url;
  if (entries.length === 0) return { url, type: resource.mimeType };
  const certificateUrl = entries.find(
    (entry) => entry.certificateUrl !== undefined,
  )?.certificateUrl;
  return {
    url,
    type: resource.mimeType,
    drm: {
      licenseUrls: Object.fromEntries(
        entries.map((entry) => [KEY_SYSTEMS[entry.type], entry.licenseUrl]),
      ),
      ...(certificateUrl === undefined ? {} : { certificateUrl }),
    },
  };
}

export const srgssr: Connector<IlComposition> = {
  type: 'srgssr/urn',
  // The browser's key systems go with the request, as pillarbox-web sends
  // them: the IL then lists the resource this browser can decrypt.
  async fetch(urn, signal) {
    const params = new URLSearchParams({ onlyChapters: 'true', vector: 'portalplay' });
    const capabilities = capabilityParameter(await drmCapabilities());
    if (capabilities !== '') params.set('drmPlayerCapabilities', capabilities);
    const url = `https://${IL_HOST}/integrationlayer/2.1/mediaComposition/byUrn/${encodeURIComponent(
      urn,
    )}?${params}`;
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`media composition failed: HTTP ${response.status}`);
    return (await response.json()) as IlComposition;
  },
  // The resources in the IL's order, which the player tries in turn, as pillarbox-web does.
  async resolve(data, signal) {
    const list = data.chapterList ?? [];
    const chapter = mainChapter(data);
    const image = chapter.imageUrl;
    const metadata: ProgrammeMetadata = {
      title: chapter.title,
      ...(image === undefined
        ? {}
        : { image: `${image}?width=320&format=jpg`, poster: `${image}?width=1280&format=jpg` }),
      chapters: chaptersOf(chapter, list),
      markers: markersOf(chapter),
    };
    if (chapter.blockReason !== undefined) {
      return { sources: [], block: blockOf(chapter.blockReason), metadata };
    }
    // Injected data was fetched elsewhere: the resources are matched to this browser again.
    const granted = await drmCapabilities();
    const sources = await Promise.all(
      (chapter.resourceList ?? []).map((resource) => sourceOf(resource, granted, signal)),
    );
    // The adaptive resources first: a progressive file is the fallback.
    const adaptive = (source: Source): boolean =>
      !/^(audio|video)\/(mp4|mpeg)/.test(source.type ?? '');
    const found = sources.filter((source) => source !== null);
    // Every resource is encrypted for key systems this browser lacks.
    if (
      found.length === 0 &&
      (chapter.resourceList ?? []).some((r) => (r.drmList?.length ?? 0) > 0)
    ) {
      return { sources: [], block: { message: NO_KEY_SYSTEM }, metadata };
    }
    return { sources: [...found.filter(adaptive), ...found.filter((s) => !adaptive(s))], metadata };
  },
};

/** The Akamai ACL for a stream URL: its directory and everything below. */
function aclPath(url: URL): string {
  const path = url.pathname;
  return `${path.substring(0, path.lastIndexOf('/') + 1)}*`;
}

/** Adds the Akamai auth parameters the token server issues for the stream's path. */
async function tokenize(streamUrl: string, signal: AbortSignal): Promise<string> {
  const url = new URL(streamUrl);
  const response = await fetch(`${TOKEN_SERVER}${encodeURIComponent(aclPath(url))}`, { signal });
  if (!response.ok) throw new Error(`token server failed: HTTP ${response.status}`);
  const data = (await response.json()) as { token?: { authparams?: string } };
  const params = new URLSearchParams(data.token?.authparams ?? '');
  for (const [key, value] of params) url.searchParams.set(key, value);
  return url.toString();
}

export function fmtDuration(ms: number): string {
  if (!ms) return '';
  const minutes = Math.round(ms / 60_000);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} h ${minutes % 60} min`
    : `${Math.max(1, minutes)} min`;
}

/** A search result as an example to play: its title, and what it is. */
async function find(query: string, unit: string, signal: AbortSignal) {
  const list = await searchMedia(unit as BusinessUnit, query, signal);
  return list.map((result) => ({
    id: result.urn,
    title: result.title,
    note: [result.mediaType.toLowerCase(), fmtDuration(result.duration)]
      .filter((bit) => bit !== '')
      .join(', '),
  }));
}

export const srgssrDemo: DemoConnector = {
  connector: srgssr,
  name: 'SRG SSR',
  placeholder: 'A URN, such as urn:rts:video:…',
  examples: (signal) => find('journal', 'rts', signal),
  search: find,
  units: BUSINESS_UNITS,
};
