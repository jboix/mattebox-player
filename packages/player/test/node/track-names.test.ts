import { afterEach, describe, expect, it } from 'vitest';
import type { TrackEntry } from '../../src/controls/track-names.js';
import { languageName, layout, trackNames } from '../../src/controls/track-names.js';

/** The texts of the items, the way the menu shows them. */
function texts(entries: readonly TrackEntry[], word: string | null = null, locale = 'en') {
  return trackNames(entries, word, locale).map((item) => item[1]);
}

/** An entry with no badges and no hints, valued by its place. */
function entry(
  name?: string,
  lang?: string,
  hints: ReadonlyArray<string | undefined> = [],
  badges: readonly string[] = [],
): TrackEntry {
  return ['', name, lang, badges, hints];
}

describe('languageName', () => {
  const real = Intl.DisplayNames;
  afterEach(() => {
    Object.defineProperty(Intl, 'DisplayNames', { value: real, configurable: true });
  });

  it('names the language in the locale', () => {
    expect(languageName('en', 'en')).toBe('English');
    expect(languageName('fr', 'de')).toBe('Französisch');
  });

  it('capitalizes a name the locale writes in lower case', () => {
    expect(languageName('en', 'fr')).toBe('Anglais');
    expect(languageName('de', 'es')).toBe('Alemán');
  });

  it('answers undefined for a code it does not know, and for a tag it rejects', () => {
    expect(languageName('qq', 'en')).toBeUndefined();
    expect(languageName('not a tag', 'en')).toBeUndefined();
    expect(languageName('en', 'not a tag')).toBeUndefined();
  });

  it('answers undefined without Intl.DisplayNames, as on Chromium 76', () => {
    Object.defineProperty(Intl, 'DisplayNames', { value: undefined, configurable: true });
    expect(languageName('en', 'en')).toBeUndefined();
  });
});

describe('layout', () => {
  it('names the common channel counts', () => {
    expect(layout('1')).toBe('Mono');
    expect(layout('2')).toBe('Stereo');
    expect(layout('6')).toBe('5.1');
    expect(layout('8')).toBe('7.1');
  });

  it('reads a JOC suffix as Dolby Atmos', () => {
    expect(layout('16/JOC')).toBe('Dolby Atmos');
  });

  it('leaves any other count as written, and no count as none', () => {
    expect(layout('3')).toBe('3');
    expect(layout(undefined)).toBeUndefined();
  });
});

describe('trackNames', () => {
  const real = Intl.DisplayNames;
  afterEach(() => {
    Object.defineProperty(Intl, 'DisplayNames', { value: real, configurable: true });
  });

  it('keeps the value and the badges of each entry', () => {
    expect(trackNames([['t-en', 'English', 'en', ['SDH'], []]], null, 'en')).toEqual([
      ['t-en', 'English', undefined, undefined, ['SDH']],
    ]);
  });

  it('reads the name first', () => {
    expect(texts([entry('Director commentary', 'en')])).toEqual(['Director commentary']);
  });

  it("reads the language's name without a name, in the locale", () => {
    expect(texts([entry(undefined, 'de')])).toEqual(['German']);
    expect(texts([entry('', 'en')], null, 'fr')).toEqual(['Anglais']);
  });

  it('reads the language code without Intl.DisplayNames, and for a code it does not know', () => {
    expect(texts([entry(undefined, 'qq')])).toEqual(['qq']);
    Object.defineProperty(Intl, 'DisplayNames', { value: undefined, configurable: true });
    expect(texts([entry(undefined, 'en')])).toEqual(['en']);
  });

  it('reads the word and the place without a name or a language', () => {
    expect(texts([entry('Main', 'en'), entry(undefined, undefined)])).toEqual(['Main', 'Track 2']);
    expect(texts([entry(undefined, '')], 'Pista')).toEqual(['Pista 1']);
  });

  it('tells twins apart by their first hint that differs', () => {
    expect(
      texts([entry(undefined, 'en', ['5.1', undefined]), entry(undefined, 'en', ['Stereo'])]),
    ).toEqual(['English (5.1)', 'English (Stereo)']);
  });

  it('skips a hint the twins share, and tries the next', () => {
    expect(
      texts([
        entry(undefined, 'en', ['Stereo', undefined]),
        entry(undefined, 'en', ['Stereo', 'commentary']),
      ]),
    ).toEqual(['English', 'English (commentary)']);
  });

  it('tells twins apart by their place when no hint differs', () => {
    expect(texts([entry('English'), entry('English'), entry('French')])).toEqual([
      'English (1)',
      'English (2)',
      'French',
    ]);
  });

  it('leaves entries apart when their badges differ', () => {
    expect(texts([entry('English'), entry('English', undefined, [], ['SDH'])])).toEqual([
      'English',
      'English',
    ]);
  });
});
