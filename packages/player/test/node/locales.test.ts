import { describe, expect, it } from 'vitest';
import { addLocale, load, onLocales, registered, wordsNow } from '../../src/locales.js';

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
