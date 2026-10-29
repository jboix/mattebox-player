import { describe, expect, it } from 'vitest';
import { expand } from '../../src/beacons.js';

describe('beacon macros', () => {
  it('fills the macros VAST 4.3 names, encoded, and -1 for one the player cannot fill', () => {
    const url = expand(
      'https://t.example/e?code=[ERRORCODE]&ph=[MEDIAPLAYHEAD]&ad=[ADPLAYHEAD]&uri=[ASSETURI]&pos=[BREAKPOSITION]&size=[PLAYERSIZE]&x=[UNKNOWN]',
      {
        errorCode: 405,
        mediaPlayhead: 3725.5,
        adPlayhead: 7.25,
        assetUri: 'https://cdn.example/ad.mp4',
        breakPosition: 2,
        playerSize: [800, 450],
      },
    );
    expect(url).toBe(
      'https://t.example/e?code=405&ph=01%3A02%3A05.500&ad=00%3A00%3A07.250&uri=https%3A%2F%2Fcdn.example%2Fad.mp4&pos=2&size=800%2C450&x=-1',
    );
  });

  it('a cache buster is eight digits, and VAST 3 names the playhead CONTENTPLAYHEAD', () => {
    const url = expand('https://t.example/i?cb=[CACHEBUSTING]&ph=[CONTENTPLAYHEAD]', {
      mediaPlayhead: 0,
    });
    expect(url).toMatch(/^https:\/\/t\.example\/i\?cb=\d{8}&ph=00%3A00%3A00\.000$/);
  });
});
