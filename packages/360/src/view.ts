/**
 * Where the viewer looks, as plain numbers. Pure, so the node tests check
 * it without a GPU.
 *
 * Angles are radians inside the package and degrees on the element. Yaw
 * turns right as it grows, pitch looks up, and `fov` is the vertical field
 * of view. Yaw 0 and pitch 0 look at the centre of the picture.
 */

/**
 * How a picture maps onto a sphere, as the player's `projection` attribute
 * names it. Kept here, so the package works with a player that predates it.
 */
export type Projection = 'equirectangular' | 'half-equirectangular';

/**
 * How one frame holds a picture for each eye, as the player's
 * `frame-packing` attribute names it: the left eye's picture over the right
 * eye's, or on its left. Kept here, so the package works with a player
 * that predates it.
 */
export type FramePacking = 'top-bottom' | 'side-by-side';

export interface View {
  readonly yaw: number;
  readonly pitch: number;
  readonly fov: number;
  /** Radians the view turns about the line of sight, counter-clockwise. Only the device's motion sets it. */
  readonly roll?: number;
}

/** Just short of straight up or down, where the yaw would flip. */
const PITCH_LIMIT = Math.PI / 2 - 0.01;

/** The narrowest and widest vertical field of view. */
export const MIN_FOV = (30 * Math.PI) / 180;
export const MAX_FOV = (100 * Math.PI) / 180;

/** The field of view a new source starts with. */
export const DEFAULT_FOV = (75 * Math.PI) / 180;

/** `view` with the pitch and the field of view in range, and the yaw within one turn. */
export function clamp(view: View): View {
  const turn = 2 * Math.PI;
  const yaw = ((((view.yaw + Math.PI) % turn) + turn) % turn) - Math.PI;
  return {
    yaw,
    pitch: Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, view.pitch)),
    fov: Math.min(MAX_FOV, Math.max(MIN_FOV, view.fov)),
    roll: view.roll ?? 0,
  };
}

/**
 * The view after a drag of `dx`, `dy` pixels over a view `height` pixels
 * tall. The picture follows the pointer: a drag to the right turns the view
 * left, and a drag down looks up. One height of drag is one field of view.
 */
export function drag(view: View, dx: number, dy: number, height: number): View {
  const radians = view.fov / Math.max(1, height);
  return clamp({ yaw: view.yaw - dx * radians, pitch: view.pitch + dy * radians, fov: view.fov });
}

/** A 3×3 matrix, row by row. */
type Matrix = readonly number[];

/** `a · b`, both row by row. */
function times(a: Matrix, b: Matrix): number[] {
  const out: number[] = [];
  for (let i = 0; i < 9; i += 1) {
    const row = i - (i % 3);
    const column = i % 3;
    out.push(
      (a[row] as number) * (b[column] as number) +
        (a[row + 1] as number) * (b[column + 3] as number) +
        (a[row + 2] as number) * (b[column + 6] as number),
    );
  }
  return out;
}

/** The rotation of `angle` radians about the x, y or z axis, row by row. */
function about(axis: 0 | 1 | 2, angle: number): number[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  if (axis === 0) return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === 1) return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

/**
 * The rotation from the camera to the world, column-major as WebGL's
 * `uniformMatrix3fv` takes it: the roll about the z axis, the pitch about
 * the x axis, then the yaw about the y axis. The camera looks down -z with
 * y up. A row-major matrix read by rows is its column-major transpose, so
 * the product is built transposed: (Ry · Rx · Rz)ᵀ = Rzᵀ · Rxᵀ · Ryᵀ.
 */
export function rotation(view: View): Float32Array {
  return new Float32Array(
    times(times(about(2, -(view.roll ?? 0)), about(0, -view.pitch)), about(1, view.yaw)),
  );
}

/**
 * Where a phone or a tablet points, as a view, from a W3C
 * `deviceorientation` event's angles in degrees and the screen's angle
 * (`screen.orientation.angle`). The yaw grows as the device turns right
 * from where `alpha` is 0. The Device Orientation Event specification
 * defines the angles: https://www.w3.org/TR/orientation-event/#deviceorientation
 *
 * The device's frame to the Earth's is Rz(α) · Rx(β) · Ry(γ). The Earth's
 * frame (z up, y north) to the view's (y up, -z ahead) is a quarter turn
 * about x, so the camera's frame to the view's is
 * Ry(α) · Rx(β) · Rz(-γ) · Rx(-90°) · Rz(-screen), the same product as
 * three.js's DeviceOrientationControls:
 * https://github.com/mrdoob/three.js/blob/r127/examples/jsm/controls/DeviceOrientationControls.js
 * It is then read back as yaw, pitch and roll, the order `rotation` uses.
 */
export function orientation(alpha: number, beta: number, gamma: number, screen: number): View {
  const radians = Math.PI / 180;
  let m = about(1, alpha * radians);
  for (const turn of [
    about(0, beta * radians),
    about(2, -gamma * radians),
    about(0, -Math.PI / 2),
    about(2, -screen * radians),
  ]) {
    m = times(m, turn);
  }
  const at = (index: number): number => m[index] as number;
  return {
    yaw: -Math.atan2(at(2), at(8)),
    pitch: Math.asin(Math.min(1, Math.max(-1, -at(5)))),
    fov: DEFAULT_FOV,
    roll: Math.atan2(at(3), at(4)),
  };
}

/**
 * The rotation from one eye of a headset to the world, column-major: the
 * eye's pose from WebXR (`XRView.transform.matrix`, column-major 4×4),
 * turned by the yaw the viewer had before the headset. The position is
 * dropped: the sphere is infinitely far.
 */
export function headset(pose: ArrayLike<number>, yaw: number): Float32Array {
  const eye: number[] = [];
  // The 4×4's upper-left 3×3 by columns, which read as rows is Eᵀ.
  for (const column of [0, 4, 8])
    eye.push(pose[column] as number, pose[column + 1] as number, pose[column + 2] as number);
  // `eye` is the column-major eye rotation E; (Ry(-yaw) · E)ᵀ = Eᵀ · Ry(-yaw)ᵀ = Eᵀ · Ry(yaw).
  return new Float32Array(times(eye, about(1, yaw)));
}

/**
 * The scale and the shift that turn a point of the viewport, from -1 to 1,
 * into a direction from the eye at z = -1, for one eye of a headset: its
 * `XRView.projectionMatrix`, column-major 4×4. A headset's frustum is
 * often off centre, which the shift carries.
 */
export function frustum(projection: ArrayLike<number>): [number, number, number, number] {
  const x = projection[0] as number;
  const y = projection[5] as number;
  return [1 / x, 1 / y, (projection[8] as number) / x, (projection[9] as number) / y];
}

/**
 * The part of a frame that holds one eye's picture, as texture coordinates
 * [left, top, right, bottom], for a frame `width` by `height` pixels. A
 * frame with one picture gives all of it.
 *
 * Half a pixel is kept off each side of a half. The picture is sampled
 * between pixels, and the edge of one eye's half would otherwise take
 * colour from the other eye's.
 */
export function eyeBox(
  packing: FramePacking | null,
  right: boolean,
  width: number,
  height: number,
): [number, number, number, number] {
  if (packing === null) return [0, 0, 1, 1];
  const from = right ? 0.5 : 0;
  if (packing === 'top-bottom') {
    const pixel = 0.5 / Math.max(1, height);
    return [0, from + pixel, 1, from + 0.5 - pixel];
  }
  const pixel = 0.5 / Math.max(1, width);
  return [from + pixel, 0, from + 0.5 - pixel, 1];
}

/** The direction the centre of the view points at, in world space: [x, y, z]. */
export function forward(view: View): [number, number, number] {
  const m = rotation(view);
  // The third column, negated: the camera's -z.
  return [-(m[6] as number), -(m[7] as number), -(m[8] as number)];
}
