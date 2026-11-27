import { describe, expect, it } from 'vitest';
import { choose } from '../../src/choose.js';
import { toLines } from '../../src/lines.js';
import { fold, nearest, occurrences, searchLines } from '../../src/search.js';

const lines = toLines([
  { start: 1, end: 4, text: 'The first train leaves the valley.' },
  { start: 12, end: 15, text: 'Then the snow begins.' },
  { start: 24, end: 27, text: 'Le TRAIN s’arrête à la vallée.' },
  { start: 31, end: 33, text: 'By noon it is at the top.' },
]);

describe('the search of a transcript', () => {
  it('ignores case and accents', () => {
    expect(fold('Vallée À')).toBe('vallee a');
    expect(searchLines(lines, 'train').map((match) => match.time)).toEqual([1, 24]);
    expect(searchLines(lines, 'ARRETE').map((match) => match.time)).toEqual([24]);
    expect(searchLines(lines, 'arrête').map((match) => match.time)).toEqual([24]);
  });

  it('finds nothing for an empty text', () => {
    expect(searchLines(lines, '   ')).toEqual([]);
    expect(occurrences('The train', '')).toEqual([]);
  });

  it('gives each occurrence as offsets into the text as written', () => {
    const text = 'Le TRAIN s’arrête à la vallée, arrêté.';
    const found = occurrences(text, 'arrete');
    expect(found.map(([from, to]) => text.slice(from, to))).toEqual(['arrête', 'arrêté']);
  });

  it('keeps the offsets right where an accent is a character of its own', () => {
    // "e" followed by a combining acute accent: two characters for one letter.
    const split = `cafe${String.fromCharCode(0x301)}`;
    const text = `${split} noir, CAF${String.fromCharCode(0xc9)}`;
    const found = occurrences(text, 'cafe');
    expect(found.map(([from, to]) => text.slice(from, to))).toEqual([
      split,
      `CAF${String.fromCharCode(0xc9)}`,
    ]);
  });

  it('starts from the first match from the playhead on, else from the first', () => {
    const matches = searchLines(lines, 'the');
    expect(matches.map((match) => match.time)).toEqual([1, 12, 31]);
    expect(nearest(matches, 0)).toBe(0);
    expect(nearest(matches, 12)).toBe(1);
    expect(nearest(matches, 20)).toBe(2);
    expect(nearest(matches, 90)).toBe(0);
    expect(nearest([], 5)).toBe(-1);
  });
});

describe('the language a transcript opens in', () => {
  const tracks = [
    { id: 'en', lang: 'en' },
    { id: 'fr', lang: 'fr-CH' },
    { id: 'pt', lang: 'pt-BR' },
    { id: 'none' },
  ];

  it('is the one the subtitles show', () => {
    expect(choose(tracks, 'fr', ['en'])).toBe('fr');
  });

  it("is the player's language, then the viewer's, when no subtitles show", () => {
    expect(choose(tracks, null, ['', 'de', 'pt-PT', 'en'])).toBe('pt');
    expect(choose(tracks, null, ['fr-CH', 'en'])).toBe('fr');
  });

  it('is the next in order when the transcript cannot read the subtitles that show', () => {
    expect(choose(tracks, 'cc1', ['en'])).toBe('en');
  });

  it('is none when no language applies', () => {
    expect(choose(tracks, null, ['de', 'ja'])).toBeNull();
    expect(choose([], 'en', ['en'])).toBeNull();
  });
});
