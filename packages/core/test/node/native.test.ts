import type { Source } from '@mattebox/player-core';
import { nativeHandler } from '@mattebox/player-core';
import { describe, expect, it } from 'vitest';

/** A video that records what happens to it, in order. Enough for the handler and eme-core. */
function recorder() {
  const log: string[] = [];
  const video = {
    disableRemotePlayback: true,
    addEventListener: (name: string) => log.push(`listen ${name}`),
    removeEventListener: (name: string) => log.push(`unlisten ${name}`),
    removeAttribute: (name: string) => log.push(`remove ${name}`),
    load: () => log.push('load'),
    set src(url: string) {
      log.push(`src ${url}`);
    },
  } as unknown as HTMLMediaElement;
  return { video, log };
}

const SOURCE: Source = { url: 'https://cdn.example/a.m3u8', type: 'application/vnd.apple.mpegurl' };

describe('nativeHandler with drm', () => {
  it('attaches DRM before src, and detaches it after the source is gone', async () => {
    const { video, log } = recorder();
    const session = await nativeHandler({ drm: { licenseUrl: 'https://drm.example/fps' } }).handle(
      SOURCE,
      video,
    );

    expect(log.indexOf('listen encrypted')).toBeGreaterThan(-1);
    expect(log.indexOf('listen encrypted')).toBeLessThan(log.indexOf(`src ${SOURCE.url}`));
    expect(session.eme?.drm.keySystem).toBeNull();

    await session.dispose();
    expect(log.indexOf('unlisten encrypted')).toBeGreaterThan(log.indexOf('load'));
  });

  it('asks a drm function per source, and attaches nothing for undefined', async () => {
    const seen: Source[] = [];
    const handler = nativeHandler({
      drm: (source) => {
        seen.push(source);
        return undefined;
      },
    });
    const { video, log } = recorder();
    const session = await handler.handle(SOURCE, video);

    expect(seen).toEqual([SOURCE]);
    expect(session.eme).toBeUndefined();
    expect(log).toEqual([`src ${SOURCE.url}`]);
  });

  it('attaches nothing without the option', async () => {
    const { video } = recorder();
    const session = await nativeHandler().handle(SOURCE, video);
    expect(session.eme).toBeUndefined();
    expect(video.disableRemotePlayback).toBe(false);
  });
});
