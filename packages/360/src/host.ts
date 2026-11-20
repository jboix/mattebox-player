/**
 * Finding the player, as guide chapter 03 of the player states the contract
 * of a control of the page's own: the nearest <mattebox-player> above,
 * through shadow hosts. A copy of the other packages' own, because the
 * player exports no base class.
 */
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
