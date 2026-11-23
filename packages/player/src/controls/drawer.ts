/**
 * The drawer: what a control shows in a sheet from the foot of a compact
 * player, shown over the page from the foot of the viewport instead, where
 * a list has the room a small player lacks.
 *
 * It is a `<dialog>` opened with `showModal()`, so the browser draws it in
 * its top layer, over whatever the page puts around the player, keeps the
 * focus inside it, and leaves the rest of the page inert. The dialog is
 * made in the control's own shadow root and the control's nodes move into
 * it, so their part names, their styles and the player's custom properties
 * apply as they do inside the player. Nothing is added to the page's body.
 *
 * `showModal()` needs Chrome 37, Safari 15.4, Firefox 98. Without it there
 * is no drawer, and the control keeps its sheet inside the player.
 */
import DRAWER_STYLE from './drawer.css?inline';

export interface DrawerOptions {
  /** The drawer's accessible name. */
  readonly label: string;
  /**
   * The viewer asked to leave: Escape, the device's Back, or a press on the
   * dim. The control decides what that does, and closes the drawer itself.
   */
  readonly dismiss: () => void;
}

/**
 * Shows `nodes` in a drawer over the page and returns the function that
 * closes it, which puts them back where they were. The nodes are siblings,
 * in order, in a shadow root. Null where the browser has no modal dialog.
 */
export function drawer(nodes: readonly HTMLElement[], options: DrawerOptions): (() => void) | null {
  const last = nodes[nodes.length - 1];
  const parent = last?.parentNode ?? null;
  if (last === undefined || parent === null) return null;
  if (typeof HTMLDialogElement === 'undefined' || !('showModal' in HTMLDialogElement.prototype)) {
    return null;
  }
  const dialog = document.createElement('dialog');
  dialog.setAttribute('part', 'drawer');
  dialog.setAttribute('aria-label', options.label);
  const style = document.createElement('style');
  style.textContent = DRAWER_STYLE;
  // After the nodes, so closing puts each one back before it, in order.
  parent.insertBefore(dialog, last.nextSibling);
  dialog.append(style, ...nodes);
  let closed = false;
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    options.dismiss();
  });
  // A browser may close the dialog whatever `cancel` said: the control follows.
  dialog.addEventListener('close', () => {
    if (!closed) options.dismiss();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) options.dismiss();
  });
  // A modal dialog does not hold the page's scroll. A wheel or a drag goes
  // to a node of the drawer that has more to show, and nowhere else: on the
  // dim, or on a list that fits, it would scroll the page behind.
  const hold = (event: Event): void => {
    const path = event.composedPath();
    if (!nodes.some((node) => node.scrollHeight > node.clientHeight && path.includes(node))) {
      event.preventDefault();
    }
  };
  dialog.addEventListener('wheel', hold, { passive: false });
  dialog.addEventListener('touchmove', hold, { passive: false });
  dialog.showModal();
  return () => {
    if (closed) return;
    closed = true;
    for (const node of nodes) dialog.parentNode?.insertBefore(node, dialog);
    dialog.close();
    dialog.remove();
  };
}
