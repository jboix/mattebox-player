import { describe, expect, it } from 'vitest';
import { clamp, DEFAULT_FOV, drag, forward, MAX_FOV, MIN_FOV } from '../../src/view.js';

const deg = (value: number): number => (value * Math.PI) / 180;

describe('the view', () => {
  it('wraps the yaw within one turn, and keeps the pitch and the field of view in range', () => {
    const view = clamp({ yaw: deg(370), pitch: deg(120), fov: deg(200) });
    expect(view.yaw).toBeCloseTo(deg(10));
    expect(view.pitch).toBeLessThan(Math.PI / 2);
    expect(view.pitch).toBeGreaterThan(deg(89));
    expect(view.fov).toBe(MAX_FOV);
    expect(clamp({ yaw: deg(-190), pitch: deg(-120), fov: 0 })).toEqual({
      yaw: expect.closeTo(deg(170)),
      pitch: expect.closeTo(-(Math.PI / 2 - 0.01)),
      fov: MIN_FOV,
    });
  });

  it('follows the pointer: a drag of one height turns one field of view', () => {
    const start = { yaw: 0, pitch: 0, fov: DEFAULT_FOV };
    const right = drag(start, 300, 0, 300);
    expect(right.yaw).toBeCloseTo(-DEFAULT_FOV);
    expect(right.pitch).toBe(0);
    expect(drag(start, 0, 30, 300).pitch).toBeCloseTo(DEFAULT_FOV / 10);
  });

  it('looks ahead at yaw 0, right at yaw 90, and up as the pitch grows', () => {
    const ahead = forward({ yaw: 0, pitch: 0, fov: DEFAULT_FOV });
    expect(ahead.map((n) => n + 0)).toEqual([0, 0, -1].map((n) => expect.closeTo(n)));
    const right = forward({ yaw: deg(90), pitch: 0, fov: DEFAULT_FOV });
    expect(right).toEqual([1, 0, 0].map((n) => expect.closeTo(n)));
    const up = forward({ yaw: deg(90), pitch: deg(30), fov: DEFAULT_FOV });
    expect(up[1]).toBeCloseTo(0.5);
    expect(up[0]).toBeCloseTo(Math.cos(deg(30)));
  });
});
