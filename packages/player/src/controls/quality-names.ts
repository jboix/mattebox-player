/**
 * The words the quality menu shows for each rendition, best first. Pure,
 * node-tested.
 *
 * A label grows only as far as it must to tell entries apart: the height,
 * the frame rate above 30, Dolby Vision or HDR, then the bitrate where two
 * entries read the same, then the codec where they still do. Entries that
 * read the same after that are one choice for a viewer, and show once.
 */
import type { Rendition } from 'mattebox';

/** The codec families a viewer may recognise, by their RFC 6381 prefix. */
const CODECS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^av(c1|c3)/, 'H.264'],
  [/^h(vc1|ev1)/, 'HEVC'],
  [/^vp0?9/, 'VP9'],
  [/^av01/, 'AV1'],
];

/** Dolby Vision, in the codec itself or as a layer over it. */
function dolbyVision(rendition: Rendition): boolean {
  const codecs = `${rendition.codecs ?? ''},${rendition.supplementalCodecs ?? ''}`;
  return /(^|[,/])\s*(dvh1|dvhe|dav1|dva1)/.test(codecs);
}

/** 0 for SDR, 1 for HDR, 2 for Dolby Vision: the sort order and the word. */
function range(rendition: Rendition): number {
  if (dolbyVision(rendition)) return 2;
  return rendition.videoRange === 'PQ' || rendition.videoRange === 'HLG' ? 1 : 0;
}

function rate(rendition: Rendition): number {
  return Math.round(rendition.frameRate ?? 0);
}

/** The average bitrate where the manifest gives one: closer to what plays. */
function bitrate(rendition: Rendition): string {
  const bps = rendition.averageBitrate ?? rendition.bitrate;
  return bps < 1e6 ? `${Math.round(bps / 1000)} kbps` : `${(bps / 1e6).toFixed(1)} Mbps`;
}

function codec(rendition: Rendition): string | undefined {
  const codecs = rendition.codecs ?? '';
  return CODECS.find(([pattern]) => pattern.test(codecs))?.[1];
}

/** The label of each rendition, best first, one entry per distinct label. */
export function qualityNames(
  renditions: readonly Rendition[],
): Array<readonly [id: string, label: string]> {
  const sorted = [...renditions].sort(
    (a, b) =>
      (b.height ?? 0) - (a.height ?? 0) ||
      rate(b) - rate(a) ||
      range(b) - range(a) ||
      (b.averageBitrate ?? b.bitrate) - (a.averageBitrate ?? a.bitrate),
  );
  const bases = sorted.map((r) => {
    const base = r.height === undefined ? bitrate(r) : `${r.height}p`;
    const fps = rate(r) > 30 ? String(rate(r)) : '';
    return `${base}${fps}${['', ' HDR', ' Dolby Vision'][range(r)]}`;
  });
  // Each step adds its part only to the entries that still share a label.
  let labels = bases;
  for (const part of [bitrate, codec]) {
    labels = labels.map((label, i) => {
      const twin = labels.some((other, j) => j !== i && other === label);
      const extra = part(sorted[i] as Rendition);
      return twin && extra !== undefined && !label.endsWith(extra) ? `${label} · ${extra}` : label;
    });
  }
  // Where nothing told a group apart (one stream on two CDNs), the parts
  // added are noise: the group keeps its base label.
  labels = labels.map((label, i) =>
    bases.every((base, j) => base !== bases[i] || labels[j] === label)
      ? (bases[i] as string)
      : label,
  );
  const seen = new Set<string>();
  const out: Array<readonly [string, string]> = [];
  sorted.forEach((r, i) => {
    const label = labels[i] as string;
    if (seen.has(label)) return;
    seen.add(label);
    out.push([r.id, label]);
  });
  return out;
}
