import { describe, expect, it } from 'vitest';
import { at, clip, EMPTY, fraction, window } from '../../src/controls/ranges.js';

describe('window', () => {
  it('maps zero to the duration for VOD', () => {
    expect(window(120, [{ start: 0, end: 120 }], false)).toEqual({ start: 0, end: 120 });
  });

  it('maps the last seekable range for live', () => {
    const seekable = [
      { start: 0, end: 10 },
      { start: 100, end: 160 },
    ];
    expect(window(Number.POSITIVE_INFINITY, seekable, true)).toEqual({ start: 100, end: 160 });
  });

  it('falls back to the duration when live has no window yet', () => {
    expect(window(120, [], true)).toEqual({ start: 0, end: 120 });
    expect(window(Number.POSITIVE_INFINITY, [], true)).toEqual(EMPTY);
  });

  it('is empty while the duration is unknown or infinite', () => {
    expect(window(Number.NaN, [], false)).toEqual(EMPTY);
    expect(window(Number.POSITIVE_INFINITY, [{ start: 0, end: 10 }], false)).toEqual(EMPTY);
    expect(window(0, [], false)).toEqual(EMPTY);
  });
});

describe('fraction and at', () => {
  const span = { start: 100, end: 200 };

  it('places a time on the span, clamped', () => {
    expect(fraction(150, span)).toBe(0.5);
    expect(fraction(50, span)).toBe(0);
    expect(fraction(250, span)).toBe(1);
    expect(fraction(5, EMPTY)).toBe(0);
  });

  it('reads the time at a fraction, clamped', () => {
    expect(at(0.25, span)).toBe(125);
    expect(at(-1, span)).toBe(100);
    expect(at(2, span)).toBe(200);
  });
});

describe('clip', () => {
  const span = { start: 0, end: 100 };

  it('turns ranges into fraction pairs inside the span', () => {
    expect(clip([{ start: 10, end: 30 }], span)).toEqual([[0.1, 0.3]]);
  });

  it('cuts what overhangs and drops what falls outside or collapses', () => {
    const ranges = [
      { start: -10, end: 20 },
      { start: 120, end: 140 },
      { start: 50, end: 50 },
      { start: 90, end: 130 },
    ];
    expect(clip(ranges, span)).toEqual([
      [0, 0.2],
      [0.9, 1],
    ]);
  });
});
