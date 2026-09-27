/**
 * Where focus goes on an arrow: the candidates, and the nearest one on the
 * side of the arrow.
 *
 * The candidates are every focusable element in the player's composed tree:
 * through open shadow roots, which hold each control's button, and through
 * slot assignment, which is how the controls are placed. Focusable means a
 * `button`, a `role="slider"`, or a `tabindex` of zero or more; disabled,
 * and not laid out, which covers `hidden`, `display: none`, and a collapsed
 * control, rules one out.
 */
export type Direction = 'up' | 'down' | 'left' | 'right';

export const DIRECTIONS: Readonly<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export const OPPOSITE: Readonly<Record<Direction, Direction>> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

function focusable(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element instanceof HTMLButtonElement) return !element.disabled;
  if (element.getAttribute('role') === 'slider') return true;
  return element.hasAttribute('tabindex') && element.tabIndex >= 0;
}

/** The focusable elements under `root`, in composed tree order, `root` itself left out. */
export function candidates(root: Element): HTMLElement[] {
  const out: HTMLElement[] = [];
  const visit = (node: Element): void => {
    if (node !== root && focusable(node) && node.getClientRects().length > 0) out.push(node);
    const children =
      node instanceof HTMLSlotElement
        ? node.assignedElements({ flatten: true })
        : [...(node.shadowRoot?.children ?? []), ...(node.shadowRoot ? [] : node.children)];
    for (const child of children) visit(child);
  };
  visit(root);
  return out;
}

/** The gap between two spans on one axis: zero when they overlap. */
function gap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, b0 - a1, a0 - b1);
}

/** How far a control may overlap the edge it lies beyond, for rounding in layout. */
const SLACK = 1;

/**
 * The candidate nearest `from` on the side of `direction`, or null. A
 * candidate is on that side when it lies wholly beyond `from`'s edge, as in
 * the W3C CSS Spatial Navigation draft: the seek bar above a row of buttons
 * spans the row, and is up from each button, never right of one.
 *
 * Left and right stay in the row: only a candidate that overlaps `from`
 * vertically counts, so the arrows never jump to the row above because a
 * control there happens to start past this one's edge. Up and down prefer a
 * candidate in line, overlapping `from` horizontally, and take the nearest
 * other one when there is none, so a button at the end of a row still
 * reaches the bar above it.
 *
 * Among the candidates, the nearest along the arrow wins, then the nearest
 * across it; the earlier in the tree breaks a tie.
 */
export function nearest(
  from: DOMRect,
  list: readonly HTMLElement[],
  direction: Direction,
): HTMLElement | null {
  const row = direction === 'left' || direction === 'right';
  let best: HTMLElement | null = null;
  let bestKey: readonly [number, number, number] = [2, 0, 0];
  for (const element of list) {
    const to = element.getBoundingClientRect();
    let along: number;
    if (direction === 'right') along = to.left - from.right;
    else if (direction === 'left') along = from.left - to.right;
    else if (direction === 'down') along = to.top - from.bottom;
    else along = from.top - to.bottom;
    if (along < -SLACK) continue;
    const side = row
      ? gap(from.top, from.bottom, to.top, to.bottom)
      : gap(from.left, from.right, to.left, to.right);
    const inLine = side === 0 ? 0 : 1;
    if (row && inLine === 1) continue;
    const key = [inLine, Math.max(0, along), side] as const;
    if (before(key, bestKey)) {
      best = element;
      bestKey = key;
    }
  }
  return best;
}

/** Whether `a` ranks before `b`: compared item by item. */
function before(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}
