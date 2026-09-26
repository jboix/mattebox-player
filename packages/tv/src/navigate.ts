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
 * spans the row, and is up from each button, never right of one. Each one
 * scores its distance along the arrow plus twice its distance across it,
 * so a control in line wins over a closer one off to the side. The lowest
 * score wins; the earlier in the tree breaks a tie.
 */
export function nearest(
  from: DOMRect,
  list: readonly HTMLElement[],
  direction: Direction,
): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  const across = direction === 'left' || direction === 'right';
  for (const element of list) {
    const to = element.getBoundingClientRect();
    let along: number;
    if (direction === 'right') along = to.left - from.right;
    else if (direction === 'left') along = from.left - to.right;
    else if (direction === 'down') along = to.top - from.bottom;
    else along = from.top - to.bottom;
    if (along < -SLACK) continue;
    const side = across
      ? gap(from.top, from.bottom, to.top, to.bottom)
      : gap(from.left, from.right, to.left, to.right);
    const score = Math.max(0, along) + 2 * side;
    if (score < bestScore) {
      best = element;
      bestScore = score;
    }
  }
  return best;
}
