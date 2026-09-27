/**
 * Replaces the children of `node`: the ones it has go, then `children` come.
 * `replaceChildren` does this in one call, from Chromium 86 (AGENTS.md,
 * rule 9). A copy of the player's own: the player's internals are not this
 * package's to import.
 */
export function setChildren(node: Node & ParentNode, ...children: Node[]): void {
  while (node.firstChild !== null) node.firstChild.remove();
  node.append(...children);
}
