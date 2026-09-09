/**
 * The menu primitive the quality, audio, subtitles and speed menus share: a
 * button that opens a popup of radio items above it, in one or more groups
 * with a heading each, and pages behind entries that open them. The button
 * carries the name and `aria-expanded`; the popup is `role="menu"`, every
 * choice a `menuitemradio` with `aria-checked`, the checked one also
 * carrying `checked` on its part name; an entry that opens a page is a
 * `menuitem` with `aria-haspopup`, and the page starts with a Back.
 *
 * Open on click. Inside, the arrows move focus across every item, Home and
 * End jump, Enter and Space choose, Escape goes back a page or closes and
 * hands focus to the button. A choice closes the popup. A pointer down
 * anywhere else closes it too.
 *
 * The popup never leaves the picture: on opening it takes the room above
 * the button inside the stage as its height and scrolls past that.
 */
import { el, state } from '../dom.js';
import type { Control } from './control.js';
import type { IconName } from './icons.js';
import { glyph, icon } from './icons.js';

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
  /** The part prefix: `quality`, `audio`, `text`, `speed`. */
  readonly name: string;
  /** The accessible name of the button. */
  readonly label: string;
  readonly icon: IconName;
}

export interface Menu extends Control {
  /** Replaces the entries, back at the first page. */
  fill(entries: readonly MenuEntry[]): void;
  /** Swaps the button's glyph, for a menu whose state shows on it. */
  show(name: IconName): void;
  close(): void;
}

/** Air between the popup's top and the stage's. */
const AIR = 8;

function isPage(entry: MenuEntry): entry is MenuPage {
  return 'entries' in entry;
}

export function menu(options: MenuOptions): Menu {
  const { name } = options;
  const root = el('div', `menu ${name}-menu`);
  const button = el('button', `control ${name}-button`);
  button.type = 'button';
  button.setAttribute('aria-label', options.label);
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  const svg = icon(options.icon);
  button.append(svg);
  const popup = el('div', `popup ${name}-popup`);
  popup.setAttribute('role', 'menu');
  popup.setAttribute('aria-label', options.label);
  popup.hidden = true;
  root.append(button, popup);

  let open = false;
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
    if (!event.composedPath().includes(root)) close();
  }

  /** Whatever room there is above the button inside the stage, so the popup never leaves the picture. */
  function fit(): void {
    const stage = root.closest('[part~="stage"]');
    if (stage === null) return;
    const room = button.getBoundingClientRect().top - stage.getBoundingClientRect().top - AIR;
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
      const back = item(`item back-item ${name}-back-item`, page.label, () => {
        stack.pop();
        render();
        items()[0]?.focus();
      });
      back.setAttribute('role', 'menuitem');
      back.setAttribute('aria-label', `Back from ${page.label}`);
      popup.append(back);
    }
    for (const entry of page.entries) {
      if (isPage(entry)) {
        const link = item(`item page-item ${name}-${entry.name}-item`, entry.label, () => {
          stack.push(entry);
          render();
          items()[0]?.focus();
        });
        link.setAttribute('role', 'menuitem');
        link.setAttribute('aria-haspopup', 'menu');
        popup.append(link);
        continue;
      }
      const section = el('div', `section ${name}-${entry.name}-section`);
      section.setAttribute('role', 'group');
      if (entry.label !== undefined) {
        section.setAttribute('aria-label', entry.label);
        section.append(el('div', `section-label ${name}-${entry.name}-label`, entry.label));
      }
      for (const [id, text] of entry.items) {
        const choice = item(`item ${name}-item ${name}-${entry.name}-item`, text, () => {
          close();
          button.focus();
          entry.onSelect(id);
        });
        choice.value = id;
        choice.setAttribute('role', 'menuitemradio');
        const on = id === entry.value;
        choice.setAttribute('aria-checked', String(on));
        state(choice, `item ${name}-item ${name}-${entry.name}-item`, { checked: on });
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
    state(root, `menu ${name}-menu`, { open: false });
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
    state(root, `menu ${name}-menu`, { open: true });
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
    root,
    fill(entries): void {
      first = entries;
      stack = [{ name, label: options.label, entries: first }];
      render();
    },
    show(glyphName: IconName): void {
      glyph(svg, glyphName);
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
