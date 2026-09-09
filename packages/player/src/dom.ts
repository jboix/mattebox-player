/**
 * The DOM helpers the panels share.
 *
 * Every element a panel creates carries a `part`, because `::part()` cannot
 * descend: `::part(quality) select` matches nothing, so an element without a
 * name of its own is unreachable from the page's stylesheet. Names are public
 * API from the first release. Each element also carries a generic name before
 * its specific one, so `::part(select)` reaches every menu at once.
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

/** A `<select>` inside its `<label>`, so neither needs an id to be associated. */
export function menu(name: string, text: string): [HTMLLabelElement, HTMLSelectElement] {
  const label = el('label', `label ${name}-label`);
  label.append(el('span', `text ${name}-text`, text));
  const select = el('select', `select ${name}-select`);
  label.append(select);
  return [label, select];
}

/** Replaces a menu's options and selects `value`. */
export function fill(
  select: HTMLSelectElement,
  items: ReadonlyArray<readonly [string, string]>,
  value: string,
): void {
  select.replaceChildren();
  for (const [id, text] of items) {
    const option = el('option', 'option', text);
    option.value = id;
    select.append(option);
  }
  select.value = value;
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
