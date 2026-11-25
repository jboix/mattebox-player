import { describe, expect, it } from 'vitest';
import {
  clamp,
  DEFAULT_FOV,
  drag,
  eyeBox,
  forward,
  frustum,
  headset,
  MAX_FOV,
  MIN_FOV,
  orientation,
  rotation,
} from '../../src/view.js';

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
      roll: 0,
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

/** The numbers of `list`, rounded to 4 places, with -0 as 0. */
function round(list: ArrayLike<number>): number[] {
  return Array.from(list, (n) => Math.round(n * 1e4) / 1e4 + 0);
}

describe('the device', () => {
  it('looks ahead, level, with a phone held upright', () => {
    const view = orientation(0, 90, 0, 0);
    expect(round([view.yaw, view.pitch, view.roll ?? 0])).toEqual([0, 0, 0]);
  });

  it('turns right as the phone turns right, and looks up as its top leans back', () => {
    // alpha grows counter-clockwise seen from above: a turn to the left.
    expect(orientation(-90, 90, 0, 0).yaw).toBeCloseTo(deg(90));
    expect(orientation(30, 90, 0, 0).yaw).toBeCloseTo(deg(-30));
    expect(orientation(0, 120, 0, 0).pitch).toBeCloseTo(deg(30));
    expect(orientation(0, 60, 0, 0).pitch).toBeCloseTo(deg(-30));
  });

  it('stays level with the phone on its side, from the screen angle', () => {
    // Landscape, turned counter-clockwise, upright: the device's x axis points up.
    const view = orientation(90, 0, -90, 90);
    expect(round([view.yaw, view.pitch, view.roll ?? 0])).toEqual([0, 0, 0]);
  });

  it('rolls the view by the screen angle about the line of sight', () => {
    expect(orientation(0, 90, 0, 10).roll).toBeCloseTo(deg(-10));
  });

  it('keeps the roll through clamp, and the rotation without it as before', () => {
    expect(clamp({ yaw: 0, pitch: 0, fov: DEFAULT_FOV, roll: 0.5 }).roll).toBe(0.5);
    expect(round(rotation({ yaw: 0, pitch: 0, fov: DEFAULT_FOV }))).toEqual([
      1, 0, 0, 0, 1, 0, 0, 0, 1,
    ]);
  });
});

describe('the headset', () => {
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  it('looks where the screen view looked when the head has not turned', () => {
    expect(round(headset(identity, 0))).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const yaw = deg(90);
    expect(round(headset(identity, yaw))).toEqual(
      round(rotation({ yaw, pitch: 0, fov: DEFAULT_FOV })),
    );
  });

  it('follows the head: a head turned left looks at the left of the picture', () => {
    // A quarter turn about y, column-major: x goes to -z, z goes to x.
    const left = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1];
    const m = headset(left, 0);
    // The camera's -z, the third column negated.
    expect(round([-(m[6] as number), -(m[7] as number), -(m[8] as number)])).toEqual([-1, 0, 0]);
    // The position, the fourth column, plays no part.
    const moved = [...left.slice(0, 12), 5, 5, 5, 1];
    expect(round(headset(moved, 0))).toEqual(round(m));
  });

  it('reads the field of view and its off-centre shift from the projection', () => {
    // 90° each way and centred: one unit at z = -1 per unit of the viewport.
    expect(frustum([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, -1, 0, 0, -0.2, 0])).toEqual([1, 1, 0, 0]);
    // An eye whose frustum leans right: (r + l) / (r - l) = 0.2.
    const [sx, , ox] = frustum([0.5, 0, 0, 0, 0, 1, 0, 0, 0.1, 0, -1, -1, 0, 0, -0.2, 0]);
    expect(sx).toBe(2);
    expect(ox).toBeCloseTo(0.2);
  });
});

describe('a frame with a picture for each eye', () => {
  it('gives all of a frame that holds one picture', () => {
    expect(eyeBox(null, false, 64, 32)).toEqual([0, 0, 1, 1]);
    expect(eyeBox(null, true, 64, 32)).toEqual([0, 0, 1, 1]);
  });

  it('gives the left eye the top or the left half, half a pixel inside it', () => {
    // 64 pixels tall: half a pixel is 1/128 of the height.
    expect(eyeBox('top-bottom', false, 64, 64)).toEqual([0, 1 / 128, 1, 0.5 - 1 / 128]);
    expect(eyeBox('top-bottom', true, 64, 64)).toEqual([0, 0.5 + 1 / 128, 1, 1 - 1 / 128]);
    expect(eyeBox('side-by-side', false, 32, 64)).toEqual([1 / 64, 0, 0.5 - 1 / 64, 1]);
    expect(eyeBox('side-by-side', true, 32, 64)).toEqual([0.5 + 1 / 64, 0, 1 - 1 / 64, 1]);
  });
});
