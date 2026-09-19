/**
 * The contract of a control of the page's own, as guide chapter 03 of the
 * player states it: the nearest <mattebox-player> above, through shadow
 * hosts, then read for `video`, `engine`, `player` and `error`, with
 * `sourcechange` heard on it. This package implements the contract from
 * outside, on purpose: the player exports no base class, and a control that
 * needs more than this surface has found a gap in the player's API.
 */
import type { PlayerHost } from '@mattebox/player';

export type { PlayerHost };

export const PLAYER = 'mattebox-player';

/** The parent, or the host of the shadow root `node` sits in, or null at the document. */
function above(node: Node): Node | null {
  const parent = node.parentNode;
  if (parent !== null) return parent;
  return node instanceof ShadowRoot ? node.host : null;
}

/** The nearest player above `node`, or null outside one. It may not be upgraded yet. */
export function findPlayer(node: Node): HTMLElement | null {
  let current: Node | null = node;
  while (current !== null) {
    if (current instanceof HTMLElement && current.localName === PLAYER) return current;
    current = above(current);
  }
  return null;
}
