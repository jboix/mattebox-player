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

export interface View {
  readonly yaw: number;
  readonly pitch: number;
  readonly fov: number;
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

/**
 * The rotation from the camera to the world, column-major as WebGL's
 * `uniformMatrix3fv` takes it: the pitch about the x axis, then the yaw
 * about the y axis. The camera looks down -z with y up.
 */
export function rotation(view: View): Float32Array {
  const cy = Math.cos(view.yaw);
  const sy = Math.sin(view.yaw);
  const cp = Math.cos(view.pitch);
  const sp = Math.sin(view.pitch);
  // Ry · Rx, written by columns.
  return new Float32Array([cy, 0, sy, -sy * sp, cp, cy * sp, -sy * cp, -sp, cy * cp]);
}

/** The direction the centre of the view points at, in world space: [x, y, z]. */
export function forward(view: View): [number, number, number] {
  const m = rotation(view);
  // The third column, negated: the camera's -z.
  return [-(m[6] as number), -(m[7] as number), -(m[8] as number)];
}
