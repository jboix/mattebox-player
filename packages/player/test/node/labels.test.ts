import { describe, expect, it } from 'vitest';
import { fill } from '../../src/labels.js';

describe('fill', () => {
  it('replaces every name it has a value for', () => {
    expect(fill('Back {seconds} seconds', { seconds: 15 })).toBe('Back 15 seconds');
    expect(fill('{current} of {duration}', { current: '1:23', duration: '4:56' })).toBe(
      '1:23 of 4:56',
    );
  });

  it('leaves a name it has no value for as written', () => {
    expect(fill('{seconds} {other}', { seconds: 1 })).toBe('1 {other}');
  });

  it('leaves text with no names alone', () => {
    expect(fill('Retry', {})).toBe('Retry');
  });
});
