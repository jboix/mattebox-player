/**
 * The DOM helpers the controls share.
 *
 * Every element a control creates carries a `part`, because `::part()`
 * cannot descend: an element without a name of its own is unreachable from
 * the page's stylesheet. Names are public API.
 */

/** An element with its part names, and its text when it has any. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  part: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.setAttribute('part', part);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Sets `part` to a base plus the state names that are on. State rides the part name because `::part()` takes no attribute selector. */
export function state(
  node: HTMLElement,
  base: string,
  on: Readonly<Record<string, boolean>>,
): void {
  const names = [base];
  for (const key of Object.keys(on)) {
    if (on[key] === true) names.push(key);
  }
  node.setAttribute('part', names.join(' '));
}
