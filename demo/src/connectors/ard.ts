/**
 * The ARD Mediathek, Germany's public broadcasters, as a connector for
 * `ard/item`: the id is an item id from the Mediathek's page gateway,
 * which describes the item with its streams. Both answer any origin.
 */
import type { Block, Connector, Source } from '@mattebox/player';
import type { DemoConnector, Example } from './types.js';
import { json } from './types.js';

const GATEWAY = 'https://api.ardmediathek.de/page-gateway';

interface ArdMedia {
  readonly url: string;
  readonly mimeType: string;
  readonly audios?: ReadonlyArray<{ readonly kind: string }>;
}

/** What the page gateway returns for an item, as far as the demo reads it. */
export interface ArdItem {
  readonly widgets: ReadonlyArray<{
    readonly title?: string;
    readonly synopsis?: string;
    readonly show?: { readonly title?: string } | null;
    readonly image?: { readonly src?: string };
    readonly blockedByFsk?: boolean;
    readonly mediaCollection?: {
      readonly embedded?: {
        readonly isGeoBlocked?: boolean;
        readonly streams?: ReadonlyArray<{
          readonly kind: string;
          readonly media: readonly ArdMedia[];
        }>;
      };
    };
  }>;
}

/** The image service's URL at `width` pixels. */
function sized(src: string | undefined, width: number): string | undefined {
  return src?.replace('{width}', String(width));
}

function blockOf(item: ArdItem['widgets'][number]): Block | undefined {
  // The item-level `geoblocked` says false for titles a request from outside
  // Germany cannot load; the media collection's flag is the one that holds.
  if (item.mediaCollection?.embedded?.isGeoBlocked === true) {
    return {
      message: {
        en: 'This programme is only available in Germany.',
        de: 'Diese Sendung ist nur in Deutschland verfügbar.',
      },
    };
  }
  if (item.blockedByFsk === true) {
    return {
      message: {
        en: 'To protect young viewers, this programme is available only at night.',
        de: 'Aus Gründen des Jugendschutzes ist diese Sendung nur nachts verfügbar.',
      },
    };
  }
  return undefined;
}

export const ard: Connector<ArdItem> = {
  type: 'ard/item',
  fetch: (id, signal) =>
    json<ArdItem>(
      `${GATEWAY}/pages/ard/item/${encodeURIComponent(id)}?embedded=true&mcV6=true`,
      signal,
    ),
  resolve(data) {
    const item = data.widgets[0];
    if (item === undefined) throw new Error('the item has no player widget');
    const image = item.image?.src;
    const metadata = {
      ...(item.title === undefined ? {} : { title: item.title }),
      ...(item.show?.title === undefined ? {} : { subtitle: item.show.title }),
      ...(item.synopsis === undefined ? {} : { description: item.synopsis }),
      ...(image === undefined
        ? {}
        : { image: sized(image, 320) as string, poster: sized(image, 1280) as string }),
    };
    const block = blockOf(item);
    if (block !== undefined) return { sources: [], block, metadata };
    const main = item.mediaCollection?.embedded?.streams?.find((stream) => stream.kind === 'main');
    // The adaptive streams, the version without audio description first.
    const adaptive = (main?.media ?? []).filter((media) => /mpegurl|dash/i.test(media.mimeType));
    const plain = (media: ArdMedia): boolean =>
      !(media.audios ?? []).some((audio) => audio.kind === 'audio-description');
    const sources: Source[] = [...adaptive.filter(plain), ...adaptive.filter((m) => !plain(m))].map(
      (media) => ({ url: media.url, type: media.mimeType }),
    );
    return { sources, metadata };
  },
};

interface ArdHome {
  readonly widgets: ReadonlyArray<{
    readonly teasers?: ReadonlyArray<{
      readonly type: string;
      readonly mediumTitle?: string;
      readonly links?: { readonly target?: { readonly id?: string } };
    }>;
  }>;
}

export const ardDemo: DemoConnector = {
  connector: ard,
  name: 'ARD',
  placeholder: 'An ARD Mediathek item id',
  async examples(signal) {
    const home = await json<ArdHome>(`${GATEWAY}/pages/ard/home?embedded=true`, signal);
    const out: Example[] = [];
    const seen = new Set<string>();
    for (const widget of home.widgets) {
      for (const teaser of widget.teasers ?? []) {
        const id = teaser.links?.target?.id;
        if (id === undefined || seen.has(id)) continue;
        if (teaser.type !== 'ondemand' && teaser.type !== 'live') continue;
        seen.add(id);
        out.push({
          id,
          title: teaser.mediumTitle ?? id,
          ...(teaser.type === 'live' ? { note: 'live' } : {}),
        });
      }
    }
    return out.slice(0, 20);
  },
};
