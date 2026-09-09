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
  /** Key id to key, base64url. Their presence forces the JavaScript route: keys are not an attribute. */
  readonly clearKeys?: Readonly<Record<string, string>>;
  readonly note?: string;
}

export const STREAMS: readonly StreamEntry[] = [
  {
    label: 'Bitmovin · Art of Motion (HLS, WebVTT thumbnails)',
    url: 'https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8',
    thumbnails:
      'https://bitdash-a.akamaihd.net/content/MI201109210084_1/thumbnails/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.vtt',
  },
  {
    label: 'Bitmovin · Art of Motion (DASH, WebVTT thumbnails)',
    url: 'https://bitdash-a.akamaihd.net/content/MI201109210084_1/mpds/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.mpd',
    thumbnails:
      'https://bitdash-a.akamaihd.net/content/MI201109210084_1/thumbnails/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.vtt',
  },
  {
    label: 'Apple bipbop basic (HLS, MPEG-TS)',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8',
    note: 'MPEG-TS segments, so the ts tier of the preset does the work',
  },
  {
    label: 'DASH-IF · Big Buck Bunny',
    url: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd',
  },
  {
    label: 'DASH-IF · multi-period (ad-insertion layout, test case 5a)',
    url: 'https://dash.akamaized.net/dash264/TestCases/5a/nomor/1.mpd',
  },
  {
    label: 'Mux · DAI stitched ads (HLS, 4 discontinuities)',
    url: 'https://test-streams.mux.dev/dai-discontinuity-deltatre/manifest.m3u8',
  },
  {
    label: 'Unified Streaming · Tears of Steel',
    url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
  },
  {
    label: 'SRG SSR · RTS (fr)',
    url: 'https://rts-vod-amd.akamaized.net/ww/14683290/5bb14625-55e0-328c-bb9d-d5be774abd88/master.m3u8',
  },
  {
    label: 'DASH-IF · live (livesim2)',
    url: 'https://livesim2.dashif.org/livesim2/testpic_2s/Manifest.mpd',
    note: 'the live badge appears once the availability window opens',
  },
  {
    label: 'SRG SSR · RTS Info (live CMAF video DVR)',
    url: 'https://rtsinfo-d.akamaized.net/out/v1/lsvs/rts-info/cmaf/hls-master.m3u8?dw=7201',
  },
  {
    label: 'SRG SSR · Couleur 3 (live audio DVR)',
    url: 'https://stxt-audiostreaming.akamaized.net/hls/live/2117380/couleur3/master.m3u8',
  },
  {
    label: 'RTS · live (muxed TS, small window)',
    url: 'https://hls-harbor-livepush.akamaized.net/live_cdn/nsqIStpj8PaG-Ev/emcQJ0pGpremocy/index.m3u8',
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
  },
  {
    label: 'mp3 (native)',
    url: 'https://download.samplelib.com/mp3/sample-3s.mp3',
    note: 'the engine parses no manifest of this type, so it never asks for it',
  },
  {
    label: 'Extensionless URL (served by the demo, native after one round of headers)',
    // Served by the demo itself, as audio with no extension in its path: the
    // shape of a signed CDN URL.
    url: '/signed/12345',
  },
];
