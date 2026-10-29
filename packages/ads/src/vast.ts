/**
 * VAST, the IAB's Video Ad Serving Template, versions 2 to 4.3: the ads of
 * a document, with the wrappers they come through followed and merged. A
 * wrapper adds its impressions, errors, tracking and click tracking to the
 * ads it leads to (VAST 4.3 §2.4.1). The ad server's own scripts (VPAID,
 * SIMID) are not played; verifications, companions and extensions are kept
 * as data for the page.
 */

/** One playable file of an ad. */
export interface VastMediaFile {
  readonly url: string;
  readonly type: string;
  readonly delivery: 'progressive' | 'streaming';
  readonly width?: number;
  readonly height?: number;
  readonly bitrate?: number;
  readonly apiFramework?: string;
}

/** A beacon an event of the ad sends, such as `start` or `firstQuartile`. */
export interface VastTracking {
  readonly event: string;
  readonly url: string;
  /** For a `progress` event: seconds into the ad. */
  readonly offset?: number;
}

/** A verification script the advertiser names, for the page to load (VAST 4.1 `<Verification>`). */
export interface VastVerification {
  readonly vendor?: string;
  readonly script?: string;
  readonly parameters?: string;
}

/** A banner shown beside the player during the ad (VAST `<Companion>`). */
export interface VastCompanion {
  readonly width?: number;
  readonly height?: number;
  /** The image, the frame or the HTML, as the ad server gives it. */
  readonly resource?: string;
  readonly kind?: 'static' | 'iframe' | 'html';
  readonly clickThrough?: string;
}

/** A linear ad, ready to play. */
export interface VastAd {
  readonly id?: string;
  /** Its place in a pod. Absent for a standalone ad. */
  readonly sequence?: number;
  readonly system?: string;
  readonly title?: string;
  /** In seconds. */
  readonly duration: number;
  /** Seconds after which the viewer may skip. Absent: the ad cannot be skipped. */
  readonly skipOffset?: number;
  readonly impressions: readonly string[];
  readonly errors: readonly string[];
  readonly mediaFiles: readonly VastMediaFile[];
  readonly tracking: readonly VastTracking[];
  readonly clickThrough?: string;
  readonly clickTracking: readonly string[];
  readonly viewable: readonly string[];
  readonly notViewable: readonly string[];
  readonly verifications: readonly VastVerification[];
  readonly companions: readonly VastCompanion[];
  /** Each `<Extension>` as XML. */
  readonly extensions: readonly string[];
}

/** What a VAST request gave: the ads to play, or why there are none. */
export interface VastResult {
  readonly ads: readonly VastAd[];
  /** The error beacons to send with `code` when there are no ads. */
  readonly errors: readonly string[];
  /** The VAST error code of a failure (VAST 4.3 §2.3.6.3). */
  readonly code?: number;
}

/** The longest chain of wrappers followed (VAST 4.3 §2.4.1.1 recommends at most 5). */
export const WRAPPER_LIMIT = 5;
/** Milliseconds a VAST request may take before error 301. */
export const TIMEOUT = 5000;

const children = (parent: Element, name: string): Element[] =>
  Array.from(parent.children).filter((child) => child.localName === name);
const child = (parent: Element, name: string): Element | undefined => children(parent, name)[0];
const text = (element: Element | undefined): string | undefined => {
  const value = element?.textContent?.trim();
  return value === undefined || value === '' ? undefined : value;
};
const texts = (parent: Element | undefined, name: string): string[] =>
  parent === undefined ? [] : children(parent, name).flatMap((e) => text(e) ?? []);
const numberOf = (element: Element, name: string): number | undefined => {
  const value = Number(element.getAttribute(name));
  return element.hasAttribute(name) && Number.isFinite(value) ? value : undefined;
};

/** Seconds of `HH:MM:SS` or `HH:MM:SS.mmm`, or undefined. */
export function clock(value: string | undefined | null): number | undefined {
  const match = /^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(value?.trim() ?? '');
  if (match === null) return undefined;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

/** Seconds of an offset: a clock time, or a percentage of `duration`. */
export function offsetOf(value: string | null, duration: number): number | undefined {
  const trimmed = value?.trim() ?? '';
  if (trimmed.endsWith('%')) {
    const percent = Number(trimmed.slice(0, -1));
    return Number.isFinite(percent) ? (duration * percent) / 100 : undefined;
  }
  return clock(trimmed);
}

/** One `<Ad>`'s linear creative and its beacons, inline or from a wrapper. */
interface Layer {
  readonly impressions: string[];
  readonly errors: string[];
  readonly tracking: VastTracking[];
  readonly clickTracking: string[];
  readonly viewable: string[];
  readonly notViewable: string[];
  readonly verifications: VastVerification[];
}

function layerOf(ad: Element, body: Element): Layer {
  const creatives = child(body, 'Creatives');
  const linears =
    creatives === undefined
      ? []
      : children(creatives, 'Creative').flatMap((c) => children(c, 'Linear'));
  const tracking: VastTracking[] = [];
  const clickTracking: string[] = [];
  for (const linear of linears) {
    const duration = clock(text(child(linear, 'Duration'))) ?? 0;
    for (const entry of children(child(linear, 'TrackingEvents') ?? linear, 'Tracking')) {
      const url = text(entry);
      const event = entry.getAttribute('event');
      if (url === undefined || event === null) continue;
      const offset =
        event === 'progress' ? offsetOf(entry.getAttribute('offset'), duration) : undefined;
      tracking.push({ event, url, ...(offset !== undefined ? { offset } : {}) });
    }
    clickTracking.push(...texts(child(linear, 'VideoClicks'), 'ClickTracking'));
  }
  const viewable = child(body, 'ViewableImpression');
  const verifications = child(body, 'AdVerifications') ?? child(ad, 'AdVerifications');
  return {
    impressions: texts(body, 'Impression'),
    errors: texts(body, 'Error'),
    tracking,
    clickTracking,
    viewable: texts(viewable, 'Viewable'),
    notViewable: texts(viewable, 'NotViewable'),
    verifications:
      verifications === undefined
        ? []
        : children(verifications, 'Verification').map((v) => {
            const vendor = v.getAttribute('vendor');
            const script = text(child(v, 'JavaScriptResource'));
            const parameters = text(child(v, 'VerificationParameters'));
            return {
              ...(vendor !== null ? { vendor } : {}),
              ...(script !== undefined ? { script } : {}),
              ...(parameters !== undefined ? { parameters } : {}),
            };
          }),
  };
}

function companionsOf(body: Element): VastCompanion[] {
  const out: VastCompanion[] = [];
  const creatives = child(body, 'Creatives');
  for (const creative of creatives === undefined ? [] : children(creatives, 'Creative')) {
    const set = child(creative, 'CompanionAds');
    for (const companion of set === undefined ? [] : children(set, 'Companion')) {
      const width = numberOf(companion, 'width');
      const height = numberOf(companion, 'height');
      const resources = [
        ['static', 'StaticResource'],
        ['iframe', 'IFrameResource'],
        ['html', 'HTMLResource'],
      ] as const;
      const found = resources.find(([, name]) => child(companion, name) !== undefined);
      const resource = found === undefined ? undefined : text(child(companion, found[1]));
      const clickThrough = text(child(companion, 'CompanionClickThrough'));
      out.push({
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
        ...(resource !== undefined && found !== undefined ? { resource, kind: found[0] } : {}),
        ...(clickThrough !== undefined ? { clickThrough } : {}),
      });
    }
  }
  return out;
}

/** The ad of an `<InLine>`, without what wrappers add, or null without a linear creative. */
function inlineAd(ad: Element, inline: Element): VastAd | null {
  const creatives = child(inline, 'Creatives');
  const linear = (creatives === undefined ? [] : children(creatives, 'Creative')).flatMap((c) =>
    children(c, 'Linear'),
  )[0];
  if (linear === undefined) return null;
  const duration = clock(text(child(linear, 'Duration'))) ?? 0;
  const skipOffset = offsetOf(linear.getAttribute('skipoffset'), duration);
  const files = child(linear, 'MediaFiles');
  const mediaFiles: VastMediaFile[] = (
    files === undefined ? [] : children(files, 'MediaFile')
  ).flatMap((file) => {
    const url = text(file);
    if (url === undefined) return [];
    const width = numberOf(file, 'width');
    const height = numberOf(file, 'height');
    const bitrate = numberOf(file, 'bitrate');
    const api = file.getAttribute('apiFramework');
    return [
      {
        url,
        type: file.getAttribute('type') ?? '',
        delivery: file.getAttribute('delivery') === 'streaming' ? 'streaming' : 'progressive',
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
        ...(bitrate !== undefined ? { bitrate } : {}),
        ...(api !== null ? { apiFramework: api } : {}),
      },
    ];
  });
  const layer = layerOf(ad, inline);
  const id = ad.getAttribute('id');
  const sequence = numberOf(ad, 'sequence');
  const system = text(child(inline, 'AdSystem'));
  const title = text(child(inline, 'AdTitle'));
  const clickThrough = text(child(child(linear, 'VideoClicks') ?? linear, 'ClickThrough'));
  const extensions = child(inline, 'Extensions');
  return {
    ...(id !== null ? { id } : {}),
    ...(sequence !== undefined ? { sequence } : {}),
    ...(system !== undefined ? { system } : {}),
    ...(title !== undefined ? { title } : {}),
    duration,
    ...(skipOffset !== undefined ? { skipOffset } : {}),
    ...layer,
    mediaFiles,
    ...(clickThrough !== undefined ? { clickThrough } : {}),
    companions: companionsOf(inline),
    extensions:
      extensions === undefined
        ? []
        : children(extensions, 'Extension').map((e) => new XMLSerializer().serializeToString(e)),
  };
}

/** Adds a wrapper's beacons to an ad it led to. */
function merged(ad: VastAd, layer: Layer): VastAd {
  return {
    ...ad,
    impressions: [...layer.impressions, ...ad.impressions],
    errors: [...layer.errors, ...ad.errors],
    tracking: [...layer.tracking, ...ad.tracking],
    clickTracking: [...layer.clickTracking, ...ad.clickTracking],
    viewable: [...layer.viewable, ...ad.viewable],
    notViewable: [...layer.notViewable, ...ad.notViewable],
    verifications: [...layer.verifications, ...ad.verifications],
  };
}

/** Fetches a VAST document's text: the page's hook, or `fetch` with credentials, as ad servers expect cookies. */
export type VastFetch = (url: string, signal: AbortSignal) => Promise<string>;

export const fetchText: VastFetch = async (url, signal) => {
  const response = await fetch(url, { credentials: 'include', signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
};

/**
 * The ads a VAST document leads to. A pod (ads with a `sequence`) plays in
 * order; without one, the first standalone ad plays. Wrappers are followed
 * up to `WRAPPER_LIMIT` deep.
 */
export async function resolveVast(
  source: { readonly url: string } | { readonly xml: string },
  load: VastFetch = fetchText,
  depth = 0,
  wrappers = true,
): Promise<VastResult> {
  let xml: string;
  if ('xml' in source) xml = source.xml;
  else {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
      xml = await load(source.url, controller.signal);
    } catch {
      return { ads: [], errors: [], code: depth > 0 ? 301 : 900 };
    } finally {
      clearTimeout(timer);
    }
  }
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const root = doc.documentElement;
  if (
    root === null ||
    root.localName !== 'VAST' ||
    doc.getElementsByTagName('parsererror').length > 0
  ) {
    return { ads: [], errors: [], code: 100 };
  }
  const nodes = children(root, 'Ad');
  if (nodes.length === 0) return { ads: [], errors: texts(root, 'Error'), code: 303 };
  const pod = nodes.filter((ad) => ad.hasAttribute('sequence'));
  const chosen =
    pod.length > 0
      ? pod.sort((a, b) => (numberOf(a, 'sequence') ?? 0) - (numberOf(b, 'sequence') ?? 0))
      : nodes.slice(0, 1);
  const ads: VastAd[] = [];
  const errors: string[] = [];
  let code: number | undefined;
  for (const ad of chosen) {
    const inline = child(ad, 'InLine');
    if (inline !== undefined) {
      const found = inlineAd(ad, inline);
      if (found === null) code = 201;
      else ads.push(found);
      continue;
    }
    const wrapper = child(ad, 'Wrapper');
    const next = text(wrapper === undefined ? undefined : child(wrapper, 'VASTAdTagURI'));
    if (wrapper === undefined || next === undefined) {
      code = 300;
      continue;
    }
    const layer = layerOf(ad, wrapper);
    if (depth + 1 > WRAPPER_LIMIT || !wrappers) {
      errors.push(...layer.errors);
      code = 302;
      continue;
    }
    const base = 'xml' in source ? location.href : source.url;
    const follow = wrapper.getAttribute('followAdditionalWrappers') !== 'false';
    const result = await resolveVast({ url: new URL(next, base).href }, load, depth + 1, follow);
    if (result.ads.length === 0) {
      errors.push(...layer.errors, ...result.errors);
      code = result.code ?? 303;
      continue;
    }
    // allowMultipleAds="false" takes one ad of what the wrapper leads to.
    const single = wrapper.getAttribute('allowMultipleAds') === 'false';
    ads.push(
      ...(single ? result.ads.slice(0, 1) : result.ads).map((found) => merged(found, layer)),
    );
  }
  if (ads.length === 0 && pod.length > 0) {
    // A pod that failed falls back to the standalone ads, as VAST 4.3 §2.3.3 lets a player.
    const standalone = nodes.filter((ad) => !ad.hasAttribute('sequence'))[0];
    const inline = standalone === undefined ? undefined : child(standalone, 'InLine');
    const found =
      standalone === undefined || inline === undefined ? null : inlineAd(standalone, inline);
    if (found !== null) return { ads: [found], errors: [] };
  }
  return { ads, errors, ...(ads.length === 0 ? { code: code ?? 303 } : {}) };
}
