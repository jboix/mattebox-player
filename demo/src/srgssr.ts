/**
 * SRG SSR content through the integration layer (IL): search by business
 * unit, resolve a URN to its media composition, pick a resource, and add
 * the Akamai token the resource needs. Demo code only: the element never
 * knows where a URL came from. Adapted from the engine's playground, itself
 * adapted from pillarbox-web.
 */

import type { ChapterInput } from 'mattebox/stages/chapters';

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

export interface Composition {
  readonly title: string;
  readonly imageUrl?: string;
  readonly resources: readonly IlResource[];
  /** The chapters of the full-length media, for `engine.chapters.set`. */
  readonly chapters: readonly ChapterInput[];
  /** The URN of the episode a clip is cut from, which has the chapters. */
  readonly fullLength?: string;
}

/** One chapter of a media composition, as the IL describes it. */
interface IlChapter {
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
  const data = (await response.json()) as { searchResultMediaList?: SearchResult[] };
  return (data.searchResultMediaList ?? []).map(({ title, urn, mediaType, date, duration }) => ({
    title,
    urn,
    mediaType,
    date,
    duration,
  }));
}

export async function fetchComposition(urn: string, signal: AbortSignal): Promise<Composition> {
  const url = `https://${IL_HOST}/integrationlayer/2.1/mediaComposition/byUrn/${encodeURIComponent(
    urn,
  )}?onlyChapters=true&vector=portalplay`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`media composition failed: HTTP ${response.status}`);
  const data = (await response.json()) as {
    chapterUrn: string;
    chapterList?: IlChapter[];
  };
  const list = data.chapterList ?? [];
  const chapter = list.find((c) => c.urn === data.chapterUrn);
  if (chapter === undefined) throw new Error('media composition has no main chapter');
  return {
    title: chapter.title,
    ...(chapter.imageUrl === undefined ? {} : { imageUrl: chapter.imageUrl }),
    resources: chapter.resourceList ?? [],
    chapters: chaptersOf(chapter, list),
    ...(chapter.fullLengthUrn === undefined ? {} : { fullLength: chapter.fullLengthUrn }),
  };
}

/** The Akamai ACL for a stream URL: its directory and everything below. */
function aclPath(url: URL): string {
  const path = url.pathname;
  return `${path.substring(0, path.lastIndexOf('/') + 1)}*`;
}

/** Adds the Akamai auth parameters the token server issues for the stream's path. */
export async function tokenize(streamUrl: string, signal: AbortSignal): Promise<string> {
  const url = new URL(streamUrl);
  const response = await fetch(`${TOKEN_SERVER}${encodeURIComponent(aclPath(url))}`, { signal });
  if (!response.ok) throw new Error(`token server failed: HTTP ${response.status}`);
  const data = (await response.json()) as { token?: { authparams?: string } };
  const params = new URLSearchParams(data.token?.authparams ?? '');
  for (const [key, value] of params) url.searchParams.set(key, value);
  return url.toString();
}

/** The DRM entry for the key system this browser has, or null for a clear resource. */
export function drmFor(resource: IlResource): DrmEntry | null {
  const fairplay = 'webkitEnterFullscreen' in document.createElement('video');
  const wanted = fairplay ? 'FAIRPLAY' : 'WIDEVINE';
  return (resource.drmList ?? []).find((d) => d.type === wanted) ?? null;
}

export function fmtDuration(ms: number): string {
  if (!ms) return '';
  const minutes = Math.round(ms / 60_000);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} h ${minutes % 60} min`
    : `${Math.max(1, minutes)} min`;
}
