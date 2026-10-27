import { describe, expect, it } from 'vitest';
import { best, nativeChoice, score } from '../../src/tracks.js';

const de = { language: 'de', kind: 'main' };
const deAd = { language: 'de', kind: 'description' };
const frAd = { language: 'fr', kind: 'description' };
const fr = { language: 'fr', kind: 'main' };

describe('the score of a track', () => {
  it('gives 3 to the language and the kind, 2 to the language, 1 to an access kind alone', () => {
    expect(score(deAd, deAd)).toBe(3);
    expect(score(de, deAd)).toBe(2);
    expect(score(frAd, deAd)).toBe(1);
    expect(score(fr, deAd)).toBe(0);
  });

  it('takes a region as its language, and gives nothing to a plain kind alone', () => {
    expect(score({ language: 'de-CH', kind: 'main' }, de)).toBe(3);
    expect(score(fr, de)).toBe(0);
    expect(score({ language: 'fr', kind: 'captions' }, { language: 'de', kind: 'captions' })).toBe(
      0,
    );
  });

  it('gives nothing without a language to match', () => {
    expect(score({ language: '', kind: 'main' }, { language: '', kind: 'main' })).toBe(0);
  });
});

describe('the best track', () => {
  it('takes the highest score, the first of equals', () => {
    expect(best([fr, de, deAd], deAd)).toBe(2);
    expect(best([fr, de, deAd], de)).toBe(1);
    expect(best([frAd, fr, de], deAd)).toBe(2);
    expect(best([fr, frAd], deAd)).toBe(1);
    expect(best([fr], deAd)).toBe(-1);
  });

  it('keeps the current track on a tie', () => {
    const two = [
      { language: 'de', kind: 'main' },
      { language: 'de-CH', kind: 'main' },
    ];
    expect(best(two, de)).toBe(0);
    expect(best(two, de, 1)).toBe(1);
  });
});

describe('a native track', () => {
  it('reads main-desc as a description and an empty kind as main', () => {
    expect(nativeChoice({ kind: 'main-desc', language: 'de' })).toEqual(deAd);
    expect(nativeChoice({ kind: '', language: 'de' })).toEqual(de);
    expect(nativeChoice({ kind: 'captions', language: 'fr' })).toEqual({
      language: 'fr',
      kind: 'captions',
    });
  });
});
