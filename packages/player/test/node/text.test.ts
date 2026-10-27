import { describe, expect, it } from 'vitest';
import { textIn } from '../../src/text.js';

describe('words by language', () => {
  const words = { de: 'Nicht verfügbar', 'fr-CH': 'Pas disponible', EN: 'Not available' };

  it('takes one string as it is', () => {
    expect(textIn('Only here', 'de')).toBe('Only here');
  });

  it('takes the tag, then its language alone, without case', () => {
    expect(textIn(words, 'FR-ch')).toBe('Pas disponible');
    expect(textIn(words, 'de-CH')).toBe('Nicht verfügbar');
  });

  it('falls back to English, then to the first entry', () => {
    expect(textIn(words, 'it')).toBe('Not available');
    expect(textIn(words, '')).toBe('Not available');
    expect(textIn({ it: 'Non disponibile', rm: 'Betg disponibel' }, 'ja')).toBe('Non disponibile');
    expect(textIn({}, 'de')).toBe('');
  });
});
