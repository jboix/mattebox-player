import { inferType } from '@mattebox/player-core';
import { describe, expect, it } from 'vitest';

describe('inferType', () => {
  it.each([
    ['https://cdn.example/vod/master.m3u8', 'application/vnd.apple.mpegurl'],
    ['https://cdn.example/vod/manifest.mpd', 'application/dash+xml'],
    ['https://cdn.example/clip.mp4', 'video/mp4'],
    ['https://cdn.example/clip.m4v', 'video/mp4'],
    ['https://cdn.example/clip.webm', 'video/webm'],
    ['https://cdn.example/song.mp3', 'audio/mpeg'],
    ['https://cdn.example/song.m4a', 'audio/mp4'],
    ['https://cdn.example/song.aac', 'audio/aac'],
    ['https://cdn.example/song.ogg', 'audio/ogg'],
    ['https://cdn.example/song.wav', 'audio/wav'],
  ])('%s is %s', (url, type) => {
    expect(inferType(url)).toBe(type);
  });

  it('ignores the query and the fragment', () => {
    expect(inferType('https://cdn.example/a/master.m3u8?token=1.mp4#t=2')).toBe(
      'application/vnd.apple.mpegurl',
    );
  });

  it('ignores case', () => {
    expect(inferType('https://cdn.example/CLIP.MP4')).toBe('video/mp4');
  });

  it('leaves an unknown or missing extension undefined', () => {
    expect(inferType('https://cdn.example/stream/12345')).toBeUndefined();
    expect(inferType('https://cdn.example/clip.mkv')).toBeUndefined();
    expect(inferType('https://cdn.example/dir.with.dots/')).toBeUndefined();
  });

  it('accepts a relative path', () => {
    expect(inferType('media/clip.mp4')).toBe('video/mp4');
  });
});
