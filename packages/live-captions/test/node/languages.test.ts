import { describe, expect, it } from 'vitest';
import { normalize } from '../../src/languages.js';

describe('normalize', () => {
  it('keeps a two-letter tag, with its region', () => {
    expect(normalize('de')).toBe('de');
    expect(normalize('de-CH')).toBe('de-CH');
  });

  it('turns a three-letter code into its two-letter one', () => {
    expect(normalize('deu')).toBe('de');
    expect(normalize('ger')).toBe('de');
    expect(normalize('cat')).toBe('ca');
    expect(normalize('fre-CA')).toBe('fr-CA');
  });

  it('fixes the case and the separator', () => {
    expect(normalize(' DE_ch ')).toBe('de-CH');
  });

  it('keeps a three-letter code without a two-letter one', () => {
    expect(normalize('gsw')).toBe('gsw');
  });

  it('names no language for an empty, undetermined, mixed or malformed tag', () => {
    for (const tag of ['', '  ', 'und', 'zxx', 'mul', 'mis', 'not a tag', null, undefined]) {
      expect(normalize(tag)).toBe('');
    }
  });
});
