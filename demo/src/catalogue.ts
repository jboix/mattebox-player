/**
 * The static content: the engine playground's list, less its generated
 * corpus, plus the sources the element's routing story needs, which the
 * demo serves itself or which take the native route.
 */

export interface StreamEntry {
  readonly label: string;
  readonly url: string;
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
  /** What the stream carries, beyond the tags `tagsOf` derives from the fields above. */
  readonly tags?: readonly string[];
  readonly note?: string;
}

/** The tags a stream shows: the ones its fields imply, then its own. */
export function tagsOf(entry: StreamEntry): string[] {
  const out: string[] = [];
  if (entry.chapters !== undefined) out.push('chapters');
  if (entry.thumbnails !== undefined) out.push('thumbnails');
  if (entry.licenseUrl !== undefined || entry.clearKeys !== undefined) out.push('DRM');
  return [...out, ...(entry.tags ?? [])];
}

/** The demo's own copy of Apple's advanced example master, with an Apple chapters entry added. */
const APPLE_CHAPTERS = 'streams/apple-chapters/master.m3u8';

export const STREAMS: readonly StreamEntry[] = [
  {
    label: 'Unified Streaming · Tears of Steel',
    url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    chapters: 'chapters/tears-of-steel.vtt',
  },
  {
    label: 'Apple bipbop basic (HLS, MPEG-TS)',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8',
    tags: ['TS', 'CEA-608'],
    note: 'MPEG-TS segments, so the ts tier of the preset does the work',
  },
  {
    label: 'DASH-IF · Big Buck Bunny',
    url: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd',
    chapters: 'chapters/big-buck-bunny.vtt',
  },
  {
    label: 'Apple · advanced example (HLS, fMP4, I-frame playlists)',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
    tags: ['I-frames', 'frame previews', 'alternate audio', 'subtitles'],
    note: 'an I-frame track: the seek bar scrubs, the preview decodes frames, the scan buttons show',
  },
  {
    label: 'Apple · advanced example, chapters in the manifest',
    url: APPLE_CHAPTERS,
    tags: ['chapters in manifest', 'I-frames', 'frame previews', 'alternate audio', 'subtitles'],
    note: 'served by the demo: the same media, with an EXT-X-SESSION-DATA entry that names an Apple chapters file',
  },
  {
    label: 'Apple · advanced example (HLS, MPEG-TS, I-frame playlists)',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8',
    tags: ['I-frames', 'TS', 'alternate audio', 'subtitles'],
    note: 'TS I-frames: the seek bar scrubs; the preview shows no decoded frame',
  },
  {
    label: 'Apple · bipbop 16x9 (HLS, MPEG-TS, I-frame playlists)',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8',
    tags: ['I-frames', 'TS', 'CEA-608'],
  },
  {
    label: 'DASH-IF livesim · trick mode',
    url: 'https://livesim2.dashif.org/vod/testpic_2s/Manifest_trickmode.mpd',
    tags: ['I-frames', 'frame previews'],
    note: 'a trick-mode AdaptationSet: the seek bar scrubs and the scan buttons show',
  },
  {
    label: 'DASH-IF · Big Buck Bunny, thumbnail tiles in the manifest',
    url: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_with_tiled_thumbnails.mpd',
    tags: ['tiles in manifest'],
    note: 'tiles and no I-frames: the preview shows the tile, and a drag seeks',
  },
  {
    label: 'DASH-IF · Big Buck Bunny, tiles and chapter images',
    url: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_with_4_tiles_thumbnails.mpd',
    chapters: 'chapters/big-buck-bunny-metadata.vtt',
    tags: ['tiles in manifest', 'chapter images'],
    note: 'a metadata chapters track: every chapter has a picture, so the menu shows them',
  },
  {
    label: 'DASH-IF livesim · live with thumbnail tiles',
    url: 'https://livesim2.dashif.org/livesim2/testpic_2s/Manifest_thumbs.mpd',
    tags: ['live', 'tiles in manifest'],
  },
  {
    label: 'Bitmovin · Art of Motion (HLS, WebVTT thumbnails)',
    url: 'https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8',
    thumbnails:
      'https://bitdash-a.akamaihd.net/content/MI201109210084_1/thumbnails/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.vtt',
  },
  {
    label: 'DASH-IF · multi-period (ad-insertion layout, test case 5a)',
    url: 'https://dash.akamaized.net/dash264/TestCases/5a/nomor/1.mpd',
    tags: ['multi-period'],
  },
  {
    label: 'Mux · DAI stitched ads (HLS, 4 discontinuities)',
    url: 'https://test-streams.mux.dev/dai-discontinuity-deltatre/manifest.m3u8',
    tags: ['ads', 'discontinuities'],
  },
  {
    label: 'SRG SSR · RTS (fr)',
    url: 'https://rts-vod-amd.akamaized.net/ww/14683290/5bb14625-55e0-328c-bb9d-d5be774abd88/master.m3u8',
  },
  {
    label: 'DASH-IF · live (livesim2)',
    url: 'https://livesim2.dashif.org/livesim2/testpic_2s/Manifest.mpd',
    tags: ['live'],
    note: 'the live badge appears once the availability window opens',
  },
  {
    label: 'SRG SSR · RTS Info (live CMAF video DVR)',
    url: 'https://rtsinfo-d.akamaized.net/out/v1/lsvs/rts-info/cmaf/hls-master.m3u8?dw=7201',
    tags: ['live', 'DVR'],
  },
  {
    label: 'SRG SSR · Couleur 3 (live audio DVR)',
    url: 'https://stxt-audiostreaming.akamaized.net/hls/live/2117380/couleur3/master.m3u8',
    tags: ['live', 'DVR', 'audio only'],
  },
  {
    label: 'Akamai live push · Big Buck Bunny (muxed TS, small window)',
    url: 'https://hls-harbor-livepush.akamaized.net/live_cdn/nsqIStpj8PaG-Ev/emcQJ0pGpremocy/index.m3u8',
    tags: ['live', 'TS'],
  },
  {
    label: 'Shaka · Angel One (Widevine DASH)',
    url: 'https://storage.googleapis.com/shaka-demo-assets/angel-one-widevine/dash.mpd',
    licenseUrl: 'https://cwip-shaka-proxy.appspot.com/no_auth',
  },
  {
    label: 'Shaka · Sintel (Widevine + PlayReady DASH)',
    url: 'https://storage.googleapis.com/shaka-demo-assets/sintel-widevine/dash.mpd',
    licenseUrl: 'https://cwip-shaka-proxy.appspot.com/no_auth',
  },
  {
    label: 'Axinom · ClearKey DASH',
    url: 'https://media.axprod.net/TestVectors/v7-MultiDRM-SingleKey/Manifest_1080p_ClearKey.mpd',
    clearKeys: { nrQFDeRLSAKTLifXUIPiZg: 'ABEiM0RVZneImaq7zN3u_w' },
    note: 'needs stages from JavaScript: keys are not an attribute',
  },
  {
    label: 'Progressive mp4 (native)',
    url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    tags: ['native'],
    chapters: 'chapters/sintel-trailer.vtt',
    note: "the chapters are the video's own text track, so they work on a native session too",
  },
  {
    label: 'mp3 (native)',
    url: 'https://download.samplelib.com/mp3/sample-3s.mp3',
    tags: ['native', 'audio only'],
    note: 'the engine parses no manifest of this type, so it never asks for it',
  },
  {
    label: 'Extensionless URL (served by the demo, native after one round of headers)',
    // Served by the demo itself, as audio with no extension in its path: the
    // shape of a signed CDN URL.
    url: '/signed/12345',
    tags: ['native', 'audio only'],
  },
];
