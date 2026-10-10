import { describe, expect, it } from 'vitest';
import { after, arrange, before } from '../../src/order.js';

/** A random source that always picks the lowest index: shuffled is reversed-ish but fixed. */
const first = () => 0;

describe('the play order', () => {
  it("is the list's own without shuffle", () => {
    expect(arrange(4, 2, false, first)).toEqual({ sequence: [0, 1, 2, 3], position: 2 });
  });

  it('keeps the item that plays first under shuffle, and every other item once', () => {
    const order = arrange(5, 3, true, (below) => below - 1);
    expect(order.position).toBe(0);
    expect(order.sequence[0]).toBe(3);
    expect([...order.sequence].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('starts before the first item when nothing plays', () => {
    expect(arrange(3, -1, true, first).position).toBe(-1);
  });

  it('stops at the ends, and wraps them under repeat all', () => {
    const end = { sequence: [0, 1, 2], position: 2 };
    const start = { sequence: [0, 1, 2], position: 0 };
    expect(after(end, 'none')).toBe(-1);
    expect(after(end, 'one')).toBe(-1);
    expect(after(end, 'all')).toBe(0);
    expect(before(start, 'none')).toBe(-1);
    expect(before(start, 'all')).toBe(2);
    expect(after(start, 'none')).toBe(1);
  });

  it('never wraps an empty list', () => {
    expect(after({ sequence: [], position: -1 }, 'all')).toBe(-1);
    expect(before({ sequence: [], position: -1 }, 'all')).toBe(-1);
  });
});
