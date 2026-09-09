import type { Player, PlayerError } from '@mattebox/player-core';
import { createPlayer, matteboxHandler, nativeHandler } from '@mattebox/player-core';
import type { TransportConfig } from 'mattebox';
import { mattebox } from 'mattebox';
import full from 'mattebox/presets/full';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Manifests small enough to read, real enough to parse. Nothing here plays:
// the tests assert which handler won, and the segments are never valid media.
const HLS_MASTER = `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-STREAM-INF:BANDWIDTH=300000,CODECS="avc1.42c015",RESOLUTION=480x270
v1.m3u8
`;

const HLS_MEDIA = `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:4
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-MAP:URI="init.mp4"
#EXTINF:4.0,
seg1.m4s
#EXT-X-ENDLIST
`;

const DASH = `<?xml version="1.0" encoding="utf-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" profiles="urn:mpeg:dash:profile:isoff-live:2011"
     type="static" mediaPresentationDuration="PT8.0S" minBufferTime="PT4.0S">
  <Period id="0" start="PT0.0S">
    <AdaptationSet id="0" contentType="video" segmentAlignment="true">
      <Representation id="0" mimeType="video/mp4" codecs="avc1.42c00d" bandwidth="150000"
                      width="320" height="180">
        <SegmentTemplate timescale="15360" initialization="init-$RepresentationID$.m4s"
                         media="chunk-$RepresentationID$-$Number%05d$.m4s" startNumber="1">
          <SegmentTimeline><S t="0" d="61440" r="1" /></SegmentTimeline>
        </SegmentTemplate>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>
`;

interface Route {
  readonly body: string;
  readonly type: string;
}

const ROUTES: Readonly<Record<string, Route>> = {
  '/hls/master.m3u8': { body: HLS_MASTER, type: 'application/vnd.apple.mpegurl' },
  '/hls/v1.m3u8': { body: HLS_MEDIA, type: 'application/vnd.apple.mpegurl' },
  '/dash/manifest.mpd': { body: DASH, type: 'application/dash+xml' },
  // The signed URL with no extension: an audio Content-Type on the manifest
  // response is one of the three MANIFEST_UNSUPPORTED routes, and the engine
  // never downloads the body.
  '/signed/12345': { body: '', type: 'audio/mpeg' },
};

/** The network the engine sees. Every request is recorded, nothing leaves the page. */
function network(): { readonly requests: string[]; readonly transport: TransportConfig } {
  const requests: string[] = [];
  return {
    requests,
    transport: {
      // Segments are not served: the tests end at the manifest.
      fetchImpl: (url: string) => {
        requests.push(url);
        const route = ROUTES[new URL(url).pathname];
        if (route === undefined) return Promise.resolve(new Response(null, { status: 404 }));
        return Promise.resolve(
          new Response(route.body, { status: 200, headers: { 'content-type': route.type } }),
        );
      },
      retry: { maxAttempts: 1 },
    },
  };
}

/**
 * Playwright's WebKit build ships no EME, and the `full` preset's `eme-core`
 * tears down with an unguarded `element.setMediaKeys(null)`, so composing the
 * DRM tier there throws out of `detach`. See docs/integrator-log.md.
 */
const EME = 'setMediaKeys' in HTMLMediaElement.prototype;
const DRM_TIER = ['eme-core', 'eme-cenc', 'eme-fairplay'];

let video: HTMLVideoElement;
let player: Player;
let requests: string[];

function build(): void {
  const net = network();
  requests = net.requests;
  player = createPlayer(video, {
    handlers: [
      matteboxHandler({
        preset: full,
        transport: net.transport,
        ...(EME ? {} : { without: DRM_TIER }),
      }),
      nativeHandler(),
    ],
  });
}

beforeEach(() => {
  video = document.createElement('video');
  video.muted = true;
  document.body.append(video);
  build();
});

afterEach(async () => {
  await player.unload();
  video.remove();
});

describe('the handler chain in a browser', () => {
  it('routes an .m3u8 to the mattebox handler', async () => {
    const session = await player.load({ url: 'https://cdn.test/hls/master.m3u8' });

    expect(session.handler).toBe('mattebox');
    expect(session.engine).not.toBeNull();
    expect(mattebox.from(video)).toBe(session.engine);
    expect(player.session).toBe(session);
  });

  it('routes an .mpd to the mattebox handler', async () => {
    const session = await player.load({ url: 'https://cdn.test/dash/manifest.mpd' });

    expect(session.handler).toBe('mattebox');
    expect(session.engine).not.toBeNull();
  });

  it('routes an .mp3 to the native handler without asking the engine for bytes', async () => {
    const session = await player.load({ url: 'https://cdn.test/audio/song.mp3' });

    expect(session.handler).toBe('native');
    expect(session.engine).toBeNull();
    expect(requests).toEqual([]);
    expect(video.getAttribute('src')).toBe('https://cdn.test/audio/song.mp3');
  });

  it('routes a progressive .mp4 to the native handler without asking the engine for bytes', async () => {
    const session = await player.load({ url: 'https://cdn.test/video/clip.mp4' });

    expect(session.handler).toBe('native');
    expect(requests).toEqual([]);
  });

  it('falls through to native after one request when the engine declines the source', async () => {
    const session = await player.load({ url: 'https://cdn.test/signed/12345' });

    expect(session.handler).toBe('native');
    // One round of headers: the extension said nothing, so the engine looked.
    // The `full` preset carries cmcd, which appends its own query, so the
    // path is what identifies the request, not the whole URL.
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0] ?? '').pathname).toBe('/signed/12345');
    expect(mattebox.from(video)).toBeNull();
  });

  it('settles two loads in order and lets the later one win', async () => {
    const order: string[] = [];
    const first = player
      .load({ url: 'https://cdn.test/hls/master.m3u8' })
      .then((session) => order.push(`a:${session.handler}`));
    const second = player
      .load({ url: 'https://cdn.test/video/clip.mp4' })
      .then((session) => order.push(`b:${session.handler}`));
    await Promise.all([first, second]);

    expect(order).toEqual(['a:mattebox', 'b:native']);
    expect(player.session?.handler).toBe('native');
    // The superseded engine session let go of the element.
    expect(mattebox.from(video)).toBeNull();
  });

  it('disposing a native session frees the element, so the next attach is not refused', async () => {
    await player.load({ url: 'https://cdn.test/video/clip.mp4' });
    expect(video.getAttribute('src')).not.toBeNull();

    await player.unload();
    expect(video.getAttribute('src')).toBeNull();

    const session = await player.load({ url: 'https://cdn.test/hls/master.m3u8' });
    expect(session.handler).toBe('mattebox');
    expect(mattebox.from(video)).toBe(session.engine);
  });

  it('reports MANIFEST_UNSUPPORTED once when no handler claims the source', async () => {
    const errors: PlayerError[] = [];
    player.on('error', (error) => errors.push(error));

    await expect(
      player.load({ url: 'https://cdn.test/a.m3u8', type: 'application/x-nonsense' }),
    ).rejects.toThrow('no handler');

    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe('MANIFEST_UNSUPPORTED');
    expect(errors[0]?.handler).toBeNull();
  });

  it("keeps a fatal error that is not a decline as the session's own", async () => {
    const errors: PlayerError[] = [];
    player.on('error', (error) => errors.push(error));

    // The manifest is not served: a 404 is fatal, and fatal is not decline.
    const session = await player.load({ url: 'https://cdn.test/hls/missing.m3u8' });

    expect(session.handler).toBe('mattebox');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.category).toBe('network');
    expect(errors[0]?.fatal).toBe(true);
    expect(errors[0]?.handler).toBe('mattebox');
  });

  it('surfaces a fatal media error from a native session once, on the unified event', async () => {
    const errors: PlayerError[] = [];
    player.on('error', (error) => errors.push(error));
    const url = URL.createObjectURL(new Blob(['not media at all'], { type: 'video/mp4' }));

    const session = await player.load({ url, type: 'video/mp4' });
    expect(session.handler).toBe('native');
    await expect.poll(() => errors.length).toBe(1);

    expect(errors[0]?.category).toBe('media');
    expect(errors[0]?.code).toBe('MEDIA_CODEC_UNSUPPORTED');
    expect(errors[0]?.handler).toBe('native');
    URL.revokeObjectURL(url);
  });
});
