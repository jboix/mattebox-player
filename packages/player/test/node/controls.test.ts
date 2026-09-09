import { describe, expect, it } from 'vitest';
import { format, describe as say } from '../../src/controls/time.js';

describe('format', () => {
  it('reads minutes and seconds under an hour', () => {
    expect(format(0)).toBe('0:00');
    expect(format(7)).toBe('0:07');
    expect(format(83.9)).toBe('1:23');
    expect(format(3599)).toBe('59:59');
  });

  it('adds the hour from an hour up, padding the minutes', () => {
    expect(format(3600)).toBe('1:00:00');
    expect(format(3661)).toBe('1:01:01');
    expect(format(36000)).toBe('10:00:00');
  });

  it('reads anything that is not a finite positive number as zero', () => {
    expect(format(Number.NaN)).toBe('0:00');
    expect(format(Number.POSITIVE_INFINITY)).toBe('0:00');
    expect(format(-5)).toBe('0:00');
  });
});

describe('describe', () => {
  it('says the position against the duration', () => {
    expect(say(83, 296)).toBe('1:23 of 4:56');
  });

  it('says the position alone when the duration is unknown or infinite', () => {
    expect(say(83, Number.NaN)).toBe('1:23');
    expect(say(83, Number.POSITIVE_INFINITY)).toBe('1:23');
  });
});
