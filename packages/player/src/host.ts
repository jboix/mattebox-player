/**
 * What a control sees of the player it sits in: the video, the engine, the
 * core, and the element itself for its events and attributes. Declared
 * here and not imported from the element, because the element registers
 * the controls and a control that imported the element would close a cycle.
 * `MatteboxPlayerElement` implements it.
 *
 * This is the whole surface a control gets. A control that needs more
 * has found a gap in the player's public API, and the gap is the bug.
 */
import type { Player, PlayerError } from '@mattebox/player-core';
import type { Mattebox } from 'mattebox';
import { PLAYER } from './tags.js';

export interface PlayerHost extends HTMLElement {
  readonly video: HTMLVideoElement;
  readonly engine: Mattebox | null;
  readonly player: Player | null;
  /** The fatal error of the current load, or null: a control attached after the event still sees it. */
  readonly error: PlayerError | null;
}

/** The parent, or the host of the shadow root `node` sits in, or null at the document. */
function above(node: Node): Node | null {
  const parent = node.parentNode;
  if (parent !== null) return parent;
  return node instanceof ShadowRoot ? node.host : null;
}

/**
 * The nearest player above `node`, through shadow hosts, or null outside
 * one. The element found may not be upgraded yet; the caller waits for the
 * definition before reading it.
 */
export function findPlayer(node: Node): HTMLElement | null {
  let current: Node | null = node;
  while (current !== null) {
    if (current instanceof HTMLElement && current.localName === PLAYER) return current;
    current = above(current);
  }
  return null;
}
