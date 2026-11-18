/**
 * The contract of a control of the page's own, as guide chapter 03 of the
 * player states it: the nearest <mattebox-player> above, through shadow
 * hosts. This package implements the contract from outside, as the cast
 * package does: the player exports no base class.
 */
import type { PlayerHost } from '@mattebox/player';

export type { PlayerHost };

export const PLAYER = 'mattebox-player';

/** The parent, or the host of the shadow root `node` sits in, or null at the document. */
export function above(node: Node): Node | null {
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

/** The element focused inside `player`, through shadow roots, or null when focus is elsewhere. */
export function focusedIn(player: HTMLElement): HTMLElement | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement != null) active = active.shadowRoot.activeElement;
  if (!(active instanceof HTMLElement) || active === player) return null;
  for (let node: Node | null = active; node !== null; node = above(node)) {
    if (node === player) return active;
  }
  return null;
}
