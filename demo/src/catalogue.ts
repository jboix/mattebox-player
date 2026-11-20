/**
 * The static content: the engine playground's list, less its generated
 * corpus, plus the sources the element's routing story needs, which the
 * demo serves itself or which take the native route.
 */
import type { Marker } from '@mattebox/player';
import type { SourceVideoTrack } from '@mattebox/player-core';

export interface StreamEntry {
  /** The heading the entry is listed under, one of `GROUPS`. */
  readonly group: Group;
  readonly label: string;
  /** The stream's URL, or the id `programme` names. */
  readonly url: string;
  /** A programme a connector resolves, in place of a URL, such as an SRG SSR URN. */
  readonly programme?: { readonly type: string; readonly id: string };
  /** A screen the entry needs, switched on when it is chosen, such as `360`. */
  readonly screen?: string;
  /** Only where the extension does not say it. */
  readonly type?: string;
  /** License server for encrypted demo streams, prefilled when the entry is chosen. */
  readonly licenseUrl?: string;
  /** A WebVTT sprite-sheet thumbnail track, for the thumbnails stage. */
  readonly thumbnails?: string;
  /** A chapters file, for the seek bar and the chapters menu. The demo serves its own. */
  readonly chapters?: string;
  /** Key id to key, base64url. Their presence forces the JavaScript route: keys are not an attribute. */
  readonly clearKeys?: Readonly<Record<string, string>>;
  /** Credits and blocked parts, as a content API would give them, for `element.markers`. */
  readonly markers?: readonly Marker[];
  /** Other versions of the picture at their own URLs, as `<mbx-video-track>` children. */
  readonly videoTracks?: readonly SourceVideoTrack[];
  /** What the stream carries, beyond the tags `tagsOf` derives from the fields above. */
  readonly tags?: readonly string[];
  readonly note?: string;
}

/** The headings of the static content, in the order the chooser lists them. */
export const GROUPS = [
  'Films',
  'Seeking and previews',
  'Tracks and chapters',
  'Live',
  'DRM',
  '360° video',
  'Formats and routing',
] as const;

export type Group = (typeof GROUPS)[number];

/** The RTS programmes the SRG SSR content API marks VIDEO_360: its connector sets their projection. */
const RTS_360: ReadonlyArray<readonly [string, string]> = [
  ['urn:rts:video:11073114', 'Le petit Burki animé, le film en 360°'],
  ['urn:rts:video:8414077', 'Le Gothard en 360°'],
  ['urn:rts:video:9191199', 'Mobilité en 360°'],
  ['urn:rts:video:7800215', 'Le goût du risque 360'],
  ['urn:rts:video:10017904', 'Test 360: Bord du lac'],
  ['urn:rts:video:10017956', 'Test 360: Vignoble'],
];

/** The tags a stream shows: the ones its fields imply, then its own. */
export function tagsOf(entry: StreamEntry): string[] {
  const out: string[] = [];
  if (entry.chapters !== undefined) out.push('chapters');
  if (entry.thumbnails !== undefined) out.push('thumbnails');
  if (entry.markers !== undefined) out.push('markers');
  if (entry.videoTracks !== undefined) out.push('versions');
  if (entry.licenseUrl !== undefined || entry.clearKeys !== undefined) out.push('DRM');
  return [...out, ...(entry.tags ?? [])];
}

/** The demo's own copy of Apple's advanced example master, with an Apple chapters entry added. */
const APPLE_CHAPTERS = 'streams/apple-chapters/master.m3u8';
/**
 * The same copy with standard track signals added: English audio marked
 * original, an audio description twin and a French twin, an SDH subtitle
 * twin, and forced English and French subtitles. Every twin plays Apple's
 * own playlist; only its label and its selection differ.
 */
const APPLE_ACCESSIBILITY = 'streams/apple-accessibility/master.m3u8';

export const STREAMS: readonly StreamEntry[] = [
  {
    group: 'Films',
    label: 'Unified Streaming · Tears of Steel',
    url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    chapters: 'chapters/tears-of-steel.vtt',
    // Examples, not the film's real credits: a skip button at both ends,
    // and a blocked part the seek bar draws broken and playback jumps over.
    markers: [
      { start: 0, end: 12, kind: 'opening-credits' },
      { start: 300, end: 330, kind: 'blocked', label: 'Not available for legal reasons' },
      { start: 640, end: 734, kind: 'closing-credits' },
    ],
    note: 'The markers are examples: Skip intro, a blocked part at 5:00, Skip credits',
  },
  {
    group: 'Formats and routing',
    label: 'Apple bipbop basic (HLS, MPEG-TS)',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8',
    tags: ['TS', 'CEA-608'],
    note: 'MPEG-TS segments, so the ts tier of the preset does the work',
  },
  {
    group: 'Films',
    label: 'DASH-IF · Big Buck Bunny',
    url: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd',
    chapters: 'chapters/big-buck-bunny.vtt',
  },
  {
    group: 'Seeking and previews',
    label: 'Apple · advanced example (HLS, fMP4, I-frame playlists)',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
    tags: ['I-frames', 'frame previews', 'alternate audio', 'subtitles'],
    note: 'an I-frame track: the seek bar scrubs, the preview decodes frames, the scan buttons show',
  },
  {
    group: 'Tracks and chapters',
    label: 'Apple · advanced example, chapters in the manifest',
    url: APPLE_CHAPTERS,
    tags: ['chapters in manifest', 'I-frames', 'frame previews', 'alternate audio', 'subtitles'],
    note: 'served by the demo: the same media, with an EXT-X-SESSION-DATA entry that names an Apple chapters file',
  },
  {
    group: 'Tracks and chapters',
    label: 'Apple · advanced example, forced subtitles and accessible tracks',
    url: APPLE_ACCESSIBILITY,
    tags: ['forced subtitles', 'audio description', 'SDH', 'original audio'],
    note: 'served by the demo: the same media, with forced, SDH, audio description and original tracks that reuse its playlists',
  },
  {
    group: 'Seeking and previews',
    label: 'Apple · advanced example (HLS, MPEG-TS, I-frame playlists)',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8',
    tags: ['I-frames', 'TS', 'alternate audio', 'subtitles'],
    note: 'TS I-frames: the seek bar scrubs; the preview shows no decoded frame',
  },
  {
    group: 'Seeking and previews',
    label: 'Apple · bipbop 16x9 (HLS, MPEG-TS, I-frame playlists)',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8',
    tags: ['I-frames', 'TS', 'CEA-608'],
  },
  {
    group: 'Seeking and previews',
    label: 'DASH-IF livesim · trick mode',
    url: 'https://livesim2.dashif.org/vod/testpic_2s/Manifest_trickmode.mpd',
    tags: ['I-frames', 'frame previews'],
    note: 'a trick-mode AdaptationSet: the seek bar scrubs and the scan buttons show',
  },
  {
    group: 'Seeking and previews',
    label: 'DASH-IF · Big Buck Bunny, thumbnail tiles in the manifest',
    url: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_with_tiled_thumbnails.mpd',
    tags: ['tiles in manifest'],
    note: 'tiles and no I-frames: the preview shows the tile, and a drag seeks',
  },
  {
    group: 'Seeking and previews',
    label: 'DASH-IF · Big Buck Bunny, tiles and chapter images',
    url: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_with_4_tiles_thumbnails.mpd',
    chapters: 'chapters/big-buck-bunny-metadata.vtt',
    tags: ['tiles in manifest', 'chapter images'],
    note: 'a metadata chapters track: every chapter has a picture, so the menu shows them',
  },
  {
    group: 'Live',
    label: 'DASH-IF livesim · live with thumbnail tiles',
    url: 'https://livesim2.dashif.org/livesim2/testpic_2s/Manifest_thumbs.mpd',
    tags: ['live', 'tiles in manifest'],
  },
  {
    group: 'Seeking and previews',
    label: 'Bitmovin · Art of Motion (HLS, WebVTT thumbnails)',
    url: 'https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8',
    thumbnails:
      'https://bitdash-a.akamaihd.net/content/MI201109210084_1/thumbnails/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.vtt',
  },
  {
    group: 'Formats and routing',
    label: 'DASH-IF · multi-period (ad-insertion layout, test case 5a)',
    url: 'https://dash.akamaized.net/dash264/TestCases/5a/nomor/1.mpd',
    tags: ['multi-period'],
  },
  {
    group: 'Formats and routing',
    label: 'Mux · DAI stitched ads (HLS, 4 discontinuities)',
    url: 'https://test-streams.mux.dev/dai-discontinuity-deltatre/manifest.m3u8',
    tags: ['ads', 'discontinuities'],
  },
  {
    group: 'Films',
    label: 'SRG SSR · RTS (fr)',
    url: 'https://rts-vod-amd.akamaized.net/ww/14683290/5bb14625-55e0-328c-bb9d-d5be774abd88/master.m3u8',
  },
  {
    group: 'Tracks and chapters',
    label: 'SRG SSR · RTS 19h30, with its sign-language version',
    url: 'https://rts-vod-amd.akamaized.net/ww/139ca45e-af4f-3fc7-8590-a3882913080b/d0eacda1-1eae-3827-bec6-bcddc3cef188/master.m3u8',
    // The 25 October 2026 edition and its "19h30 signé", in Swiss-French Sign Language.
    videoTracks: [
      {
        url: 'https://rts-vod-amd.akamaized.net/ww/96eae620-b201-3903-ae09-f21361d05e9e/6776b38c-e973-3e62-a725-193916e86827/master.m3u8',
        kind: 'sign',
        label: '19h30 signé',
        language: 'ssr',
      },
    ],
    note: 'the video menu switches to the signed version at the same time',
  },
  {
    group: 'Live',
    label: 'DASH-IF · live (livesim2)',
    url: 'https://livesim2.dashif.org/livesim2/testpic_2s/Manifest.mpd',
    tags: ['live'],
    note: 'the live badge appears once the availability window opens',
  },
  {
    group: 'Live',
    label: 'SRG SSR · RTS Info (live CMAF video DVR)',
    url: 'https://rtsinfo-d.akamaized.net/out/v1/lsvs/rts-info/cmaf/hls-master.m3u8?dw=7201',
    tags: ['live', 'DVR'],
  },
  {
    group: 'Live',
    label: 'SRG SSR · Couleur 3 (live audio DVR)',
    url: 'https://stxt-audiostreaming.akamaized.net/hls/live/2117380/couleur3/master.m3u8',
    tags: ['live', 'DVR', 'audio only'],
  },
  {
    group: 'Live',
    label: 'Akamai live push · Big Buck Bunny (muxed TS, small window)',
    url: 'https://hls-harbor-livepush.akamaized.net/live_cdn/nsqIStpj8PaG-Ev/emcQJ0pGpremocy/index.m3u8',
    tags: ['live', 'TS'],
  },
  {
    group: 'DRM',
    label: 'Shaka · Angel One (Widevine DASH)',
    url: 'https://storage.googleapis.com/shaka-demo-assets/angel-one-widevine/dash.mpd',
    licenseUrl: 'https://cwip-shaka-proxy.appspot.com/no_auth',
  },
  {
    group: 'DRM',
    label: 'Shaka · Sintel (Widevine + PlayReady DASH)',
    url: 'https://storage.googleapis.com/shaka-demo-assets/sintel-widevine/dash.mpd',
    licenseUrl: 'https://cwip-shaka-proxy.appspot.com/no_auth',
  },
  {
    // ByteArk's test pair for its WisePlay sample app
    // (github.com/byteark/huawei-wiseplay-example-app).
    group: 'DRM',
    label: 'ByteArk · Big Buck Bunny (WisePlay DASH)',
    url: 'https://byteark-dev-video-sample.st-th-1.byteark.com/wiseplay/big_buck_bunny/playlist.mpd',
    licenseUrl:
      'https://byteark-drm.develop.poring.arkcube.com/wp/license/testwiseplayservice/bunnywiseplay',
    tags: ['WisePlay'],
    note: 'plays only with a WisePlay CDM (LG webOS, Huawei) and a mattebox release with eme-wiseplay',
  },
  {
    group: 'DRM',
    label: 'Axinom · ClearKey DASH',
    url: 'https://media.axprod.net/TestVectors/v7-MultiDRM-SingleKey/Manifest_1080p_ClearKey.mpd',
    clearKeys: { nrQFDeRLSAKTLifXUIPiZg: 'ABEiM0RVZneImaq7zN3u_w' },
    note: 'needs stages from JavaScript: keys are not an attribute',
  },
  ...RTS_360.map(
    ([urn, title]): StreamEntry => ({
      group: '360° video',
      label: `SRG SSR · RTS ${title}`,
      url: urn,
      programme: { type: 'srgssr/urn', id: urn },
      screen: '360',
      tags: ['360°', 'connector'],
      note: 'the SRG SSR connector reads VIDEO_360 from the IL and sets the projection; the 360° view switches on',
    }),
  ),
  {
    group: 'Formats and routing',
    label: 'Progressive mp4 (native)',
    url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    tags: ['native'],
    chapters: 'chapters/sintel-trailer.vtt',
    note: "the chapters are the video's own text track, so they work on a native session too",
  },
  {
    group: 'Formats and routing',
    label: 'mp3 (native)',
    url: 'https://download.samplelib.com/mp3/sample-3s.mp3',
    tags: ['native', 'audio only'],
    note: 'the engine parses no manifest of this type, so it never asks for it',
  },
  {
    group: 'Formats and routing',
    label: 'Extensionless URL (served by the demo, native after one round of headers)',
    // Served by the demo itself, as audio with no extension in its path: the
    // shape of a signed CDN URL.
    url: '/signed/12345',
    tags: ['native', 'audio only'],
  },
];
