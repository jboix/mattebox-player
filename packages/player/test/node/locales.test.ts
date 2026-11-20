import { describe, expect, it } from 'vitest';
import ar from '../../src/locales/ar.js';
import ca from '../../src/locales/ca.js';
import de from '../../src/locales/de.js';
import es from '../../src/locales/es.js';
import fr from '../../src/locales/fr.js';
import hi from '../../src/locales/hi.js';
import it_ from '../../src/locales/it.js';
import ja from '../../src/locales/ja.js';
import ko from '../../src/locales/ko.js';
import pt from '../../src/locales/pt.js';
import zh from '../../src/locales/zh.js';
import { addLocale, load, onLocales, registered, wordsNow } from '../../src/locales.js';
import type { PlayerMessages } from '../../src/messages.js';

describe('the language registry', () => {
  it('falls back from a region to its language, and to nothing', () => {
    addLocale('xa', [{ play: 'A' }]);
    expect(registered('xa')).toBe('xa');
    expect(registered('XA-CH')).toBe('xa');
    expect(registered('xb')).toBeNull();
    expect(registered('')).toBeNull();
  });

  it('merges word sets in order, so a later set goes over an earlier one', () => {
    addLocale('xc', [{ play: 'One', pause: 'Two' }]);
    addLocale('XC', [{ play: 'Three' }]);
    expect(wordsNow('xc')).toEqual({ play: 'Three', pause: 'Two' });
  });

  it('runs a loader only when asked, and keeps what it loaded', async () => {
    let runs = 0;
    addLocale('xd', [
      () => {
        runs++;
        return Promise.resolve({ default: { play: 'Loaded' } });
      },
      { pause: 'Own' },
    ]);
    expect(runs).toBe(0);
    expect(wordsNow('xd')).toBeNull();
    expect(await load('xd')).toEqual({ play: 'Loaded', pause: 'Own' });
    expect(wordsNow('xd')).toEqual({ play: 'Loaded', pause: 'Own' });
    await load('xd');
    expect(runs).toBe(1);
  });

  it('tells its listeners of every registration', () => {
    let heard = 0;
    const off = onLocales(() => heard++);
    addLocale('xe', [{}]);
    off();
    addLocale('xe', [{}]);
    expect(heard).toBe(1);
  });
});

/** The shipped languages of the player. */
const LANGUAGES: Readonly<Record<string, PlayerMessages>> = {
  ar,
  ca,
  de,
  es,
  fr,
  hi,
  it: it_,
  ja,
  ko,
  pt,
  zh,
};

/** The `{name}` values a word fills in, sorted. */
function placeholders(word: string): string[] {
  return (word.match(/\{[a-z]+\}/gi) ?? []).sort();
}

describe('the shipped languages', () => {
  // A word may leave a value out: Arabic says "one key" for `drmKey`, with no count.
  it('give the same ids, and fill in no value the German does not', () => {
    expect(Object.keys(LANGUAGES)).toHaveLength(11);
    for (const words of Object.values(LANGUAGES)) {
      expect(Object.keys(words).sort()).toEqual(Object.keys(de).sort());
      for (const [id, word] of Object.entries(words)) {
        expect(word.trim(), id).not.toBe('');
        const known = placeholders(de[id as keyof PlayerMessages]);
        for (const name of placeholders(word)) expect(known, id).toContain(name);
      }
    }
  });

  it('name AirPlay in the line under AirPlay, and the device in the line under a Chromecast', () => {
    for (const words of Object.values(LANGUAGES)) {
      expect(words.playingOnAirplay).toContain('AirPlay');
      expect(words.castingTo).toContain('{device}');
    }
  });
});
