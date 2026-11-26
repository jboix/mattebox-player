import type { Source } from '@mattebox/player-core';
import { nativeHandler, pendingSeek, seek } from '@mattebox/player-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The handler reads the vendor, and Node's navigator has none.
beforeEach(() => {
  vi.stubGlobal('navigator', { vendor: 'Google Inc.' });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

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

/** A video that keeps its listeners, so a test fires `loadeddata`, and records each seek. */
function seekable() {
  const seeks: number[] = [];
  const listeners = new Map<string, () => void>();
  const video = {
    disableRemotePlayback: true,
    addEventListener: (name: string, listener: () => void) => listeners.set(name, listener),
    removeEventListener: (name: string) => listeners.delete(name),
    removeAttribute: () => undefined,
    load: () => undefined,
    set src(_url: string) {},
    set currentTime(time: number) {
      seeks.push(time);
    },
  } as unknown as HTMLMediaElement;
  return { video, seeks, frame: () => listeners.get('loadeddata')?.(), listeners };
}

describe('nativeHandler and a seek before the first frame', () => {
  const START: Source = { ...SOURCE, start: 300 };

  it('seeks to the start at once where the browser takes it', async () => {
    const { video, seeks, listeners } = seekable();
    await nativeHandler().handle(START, video);

    expect(seeks).toEqual([300]);
    expect(pendingSeek(video)).toBeNull();
    expect(listeners.has('loadeddata')).toBe(false);

    seek(video, 20);
    expect(seeks).toEqual([300, 20]);
  });

  it("keeps the start for the first frame on Apple's WebKit, which loses a seek before it", async () => {
    vi.stubGlobal('navigator', { vendor: 'Apple Computer, Inc.' });
    const { video, seeks, frame } = seekable();
    await nativeHandler().handle(START, video);

    expect(seeks).toEqual([]);
    expect(pendingSeek(video)).toBe(300);

    frame();
    expect(seeks).toEqual([300]);
    expect(pendingSeek(video)).toBeNull();
  });

  it('keeps the last seek made before the first frame, and seeks at once after it', async () => {
    vi.stubGlobal('navigator', { vendor: 'Apple Computer, Inc.' });
    const { video, seeks, frame } = seekable();
    await nativeHandler().handle(START, video);

    seek(video, 40);
    seek(video, 50);
    expect(seeks).toEqual([]);
    expect(pendingSeek(video)).toBe(50);

    frame();
    expect(seeks).toEqual([50]);

    seek(video, 60);
    expect(seeks).toEqual([50, 60]);
    expect(pendingSeek(video)).toBeNull();
  });

  it('seeks nowhere at the first frame of a source nothing sought', async () => {
    vi.stubGlobal('navigator', { vendor: 'Apple Computer, Inc.' });
    const { video, seeks, frame } = seekable();
    await nativeHandler().handle(SOURCE, video);

    expect(pendingSeek(video)).toBeNull();
    frame();
    expect(seeks).toEqual([]);
  });

  it('drops the seek it kept when the source goes before its first frame', async () => {
    vi.stubGlobal('navigator', { vendor: 'Apple Computer, Inc.' });
    const { video, seeks, listeners } = seekable();
    const session = await nativeHandler().handle(START, video);

    await session.dispose();
    expect(pendingSeek(video)).toBeNull();
    expect(listeners.has('loadeddata')).toBe(false);

    // No wait is left: the next seek is the browser's.
    seek(video, 10);
    expect(seeks).toEqual([10]);
  });

  it('gives the next source on the same video a wait of its own', async () => {
    vi.stubGlobal('navigator', { vendor: 'Apple Computer, Inc.' });
    const { video, seeks, frame } = seekable();
    const first = await nativeHandler().handle(START, video);
    await first.dispose();
    await nativeHandler().handle({ ...SOURCE, start: 7 }, video);

    expect(pendingSeek(video)).toBe(7);
    frame();
    expect(seeks).toEqual([7]);
  });
});
