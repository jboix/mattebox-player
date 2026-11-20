/**
 * Puts `children` in `parent` in place of what it held. replaceChildren()
 * needs Chromium 86, and the hosted demo runs on the TV floor, Chromium 76.
 */
export function setChildren(parent: Node, ...children: Array<Node | string>): void {
  while (parent.firstChild !== null) parent.removeChild(parent.firstChild);
  for (const child of children) {
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}
