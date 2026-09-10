/**
 * The menu primitive the quality, audio, subtitles and speed menus share: a
 * button that opens a popup of radio items above it, in one or more groups
 * with a heading each, and pages behind entries that open them. The button
 * carries the name and `aria-expanded`; the popup is `role="menu"`, every
 * choice a `menuitemradio` with `aria-checked`, the checked one also
 * carrying `checked` on its part name, because an item inside a shadow
 * root has no other seam a page can style; an entry that opens a page is
 * a `menuitem` with `aria-haspopup`, and the page starts with a Back.
 *
 * Open on click. Inside, the arrows move focus across every item, Home and
 * End jump, Enter and Space choose, Escape goes back a page or closes and
 * hands focus to the button. A choice closes the popup. A pointer down
 * anywhere else closes it too.
 *
 * The popup never leaves the picture: on opening it takes the room above
 * the button down to `ceiling()` as its height and scrolls past that. The
 * element that owns the menu carries `open` while the popup shows, which
 * the bar reads to hold its fade.
 */
import { el, state } from '../dom.js';

export interface MenuGroup {
  /** The part suffix: `track`, `size`. */
  readonly name: string;
  /** A heading, or none for a menu of one group. */
  readonly label?: string;
  readonly items: ReadonlyArray<readonly [string, string]>;
  readonly value: string;
  readonly onSelect: (value: string) => void;
}

/** An entry that opens a page of groups, with a Back at its top. */
export interface MenuPage {
  readonly name: string;
  readonly label: string;
  readonly entries: readonly MenuEntry[];
}

export type MenuEntry = MenuGroup | MenuPage;

export interface MenuOptions {
  /** The element the menu belongs to: it carries `open`, and a pointer inside it is not outside. */
  readonly host: HTMLElement;
  /** The top of the picture, in viewport pixels, which the popup never rises above. */
  readonly ceiling: () => number | null;
  /** The name of the Back item, from the page it leaves: "Back from {page}". */
  readonly back: (page: string) => string;
}

export interface Menu {
  readonly button: HTMLButtonElement;
  readonly popup: HTMLElement;
  /** The accessible name of the button and the popup. */
  label(text: string): void;
  /** Replaces the entries, back at the first page. */
  fill(entries: readonly MenuEntry[]): void;
  close(): void;
  dispose(): void;
}

/** Air between the popup's top and the picture's. */
const AIR = 8;

function isPage(entry: MenuEntry): entry is MenuPage {
  return 'entries' in entry;
}

export function menu(options: MenuOptions): Menu {
  const { host } = options;
  const button = el('button', 'button');
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  const popup = el('div', 'popup');
  popup.setAttribute('role', 'menu');
  popup.hidden = true;

  let open = false;
  let name = '';
  let first: readonly MenuEntry[] = [];
  /** The pages opened, the first being the menu itself. */
  let stack: MenuPage[] = [];
  const handlers = new WeakMap<HTMLButtonElement, () => void>();

  function items(): HTMLButtonElement[] {
    return [...popup.querySelectorAll('button')];
  }

  function checked(): HTMLButtonElement | undefined {
    return items().find((item) => item.getAttribute('aria-checked') === 'true');
  }

  /** The focused element as this tree sees it: inside shadow DOM, `document.activeElement` is the host. */
  function focused(): Element | null {
    return (popup.getRootNode() as Document | ShadowRoot).activeElement;
  }

  function outside(event: PointerEvent): void {
    if (!event.composedPath().includes(host)) close();
  }

  /** Whatever room there is above the button down to the ceiling, so the popup never leaves the picture. */
  function fit(): void {
    const top = options.ceiling();
    if (top === null) return;
    const room = button.getBoundingClientRect().top - top - AIR;
    popup.style.maxHeight = `${Math.max(0, Math.floor(room))}px`;
  }

  function clear(): void {
    for (const item of items()) {
      const handler = handlers.get(item);
      if (handler !== undefined) item.removeEventListener('click', handler);
    }
    popup.replaceChildren();
  }

  function item(part: string, text: string, handler: () => void): HTMLButtonElement {
    const node = el('button', part, text);
    node.type = 'button';
    node.tabIndex = -1;
    handlers.set(node, handler);
    node.addEventListener('click', handler);
    return node;
  }

  /** Draws the page on top of the stack. */
  function render(): void {
    clear();
    const page = stack[stack.length - 1];
    if (page === undefined) return;
    let tab = true;
    if (stack.length > 1) {
      const back = item('item back-item', page.label, () => {
        stack.pop();
        render();
        items()[0]?.focus();
      });
      back.setAttribute('role', 'menuitem');
      back.setAttribute('aria-label', options.back(page.label));
      popup.append(back);
    }
    for (const entry of page.entries) {
      if (isPage(entry)) {
        const link = item(`item page-item ${entry.name}-item`, entry.label, () => {
          stack.push(entry);
          render();
          items()[0]?.focus();
        });
        link.setAttribute('role', 'menuitem');
        link.setAttribute('aria-haspopup', 'menu');
        popup.append(link);
        continue;
      }
      const section = el('div', `section ${entry.name}-section`);
      section.setAttribute('role', 'group');
      if (entry.label !== undefined) {
        section.setAttribute('aria-label', entry.label);
        section.append(el('div', `section-label ${entry.name}-label`, entry.label));
      }
      for (const [id, text] of entry.items) {
        const choice = item(`item ${entry.name}-item`, text, () => {
          close();
          button.focus();
          entry.onSelect(id);
        });
        choice.value = id;
        choice.setAttribute('role', 'menuitemradio');
        const on = id === entry.value;
        choice.setAttribute('aria-checked', String(on));
        state(choice, `item ${entry.name}-item`, { checked: on });
        // One tab stop: the first checked item.
        if (on && tab) {
          choice.tabIndex = 0;
          tab = false;
        }
        section.append(choice);
      }
      popup.append(section);
    }
    fit();
  }

  function close(): void {
    if (!open) return;
    open = false;
    popup.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    host.removeAttribute('open');
    document.removeEventListener('pointerdown', outside, true);
    if (stack.length > 1) {
      stack = stack.slice(0, 1);
      render();
    }
  }

  function show(): void {
    if (open) return;
    open = true;
    popup.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    host.setAttribute('open', '');
    document.addEventListener('pointerdown', outside, true);
    fit();
    (checked() ?? items()[0])?.focus();
  }

  function toggle(): void {
    if (open) close();
    else show();
  }

  function key(event: KeyboardEvent): void {
    const list = items();
    const index = list.indexOf(focused() as HTMLButtonElement);
    let next: number;
    switch (event.key) {
      case 'ArrowDown':
        next = (index + 1) % list.length;
        break;
      case 'ArrowUp':
        next = (index - 1 + list.length) % list.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = list.length - 1;
        break;
      case 'Escape':
        event.preventDefault();
        if (stack.length > 1) {
          stack.pop();
          render();
          items()[0]?.focus();
          return;
        }
        close();
        button.focus();
        return;
      default:
        return;
    }
    event.preventDefault();
    list[next]?.focus();
  }

  button.addEventListener('click', toggle);
  popup.addEventListener('keydown', key);

  return {
    button,
    popup,
    label(text: string): void {
      name = text;
      button.setAttribute('aria-label', text);
      popup.setAttribute('aria-label', text);
      const root = stack[0];
      if (root !== undefined) stack[0] = { ...root, label: text };
    },
    fill(entries): void {
      first = entries;
      stack = [{ name: 'menu', label: name, entries: first }];
      render();
    },
    close,
    dispose(): void {
      close();
      clear();
      button.removeEventListener('click', toggle);
      popup.removeEventListener('keydown', key);
    },
  };
}
