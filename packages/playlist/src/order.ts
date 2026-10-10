/**
 * The play order: the list's own order, or a shuffled one, and where in it
 * playback is. Shuffle never touches the list: it plays the items in
 * another order, and turning it off goes back to the list's. Pure, apart
 * from the random source, which is given.
 */

export type RepeatMode = 'none' | 'all' | 'one';

export interface Order {
  /** Item indexes in play order. */
  readonly sequence: readonly number[];
  /** Where playback is in `sequence`, or -1 before the first item. */
  readonly position: number;
}

/** A random integer from 0 to `below - 1`. */
export type Random = (below: number) => number;

export const random: Random = (below) => Math.floor(Math.random() * below);

/** 0 to `length - 1`, in the list's order. */
function identity(length: number): number[] {
  return Array.from({ length }, (_, i) => i);
}

/** Fisher-Yates over a copy. */
function shuffled(list: readonly number[], rand: Random): number[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = rand(i + 1);
    [out[i], out[j]] = [out[j] as number, out[i] as number];
  }
  return out;
}

/**
 * The order for `length` items with `current` playing: the list's order,
 * or `current` first and the rest shuffled, so the item that plays stays
 * where the viewer is.
 */
export function arrange(length: number, current: number, shuffle: boolean, rand: Random): Order {
  if (!shuffle) return { sequence: identity(length), position: current };
  const rest = identity(length).filter((i) => i !== current);
  const sequence = current < 0 ? shuffled(rest, rand) : [current, ...shuffled(rest, rand)];
  return { sequence, position: current < 0 ? -1 : 0 };
}

/** The position after `order`'s, or -1 at the end. Repeat all wraps. */
export function after(order: Order, repeat: RepeatMode): number {
  const next = order.position + 1;
  if (next < order.sequence.length) return next;
  return repeat === 'all' && order.sequence.length > 0 ? 0 : -1;
}

/** The position before `order`'s, or -1 at the start. Repeat all wraps. */
export function before(order: Order, repeat: RepeatMode): number {
  const previous = order.position - 1;
  if (previous >= 0) return previous;
  return repeat === 'all' && order.sequence.length > 0 ? order.sequence.length - 1 : -1;
}
