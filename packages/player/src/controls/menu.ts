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
 * the button up to the top of `picture()` as its height and scrolls past
 * that, and the room from its right edge to the picture's left as its
 * width, where a long item ends in an ellipsis. The
 * element that owns the menu carries `open` while the popup shows, which
 * the bar reads to hold its fade.
 */
import { el, setChildren, state } from '../dom.js';

export interface MenuGroup {
  /** The part suffix: `track`, `size`. */
  readonly name: string;
  /** A heading, or none for a menu of one group. */
  readonly label?: string;
  /** The label names the group for a screen reader, and no heading is drawn. */
  readonly hideLabel?: boolean;
  /**
   * Each item's id, its text, a detail drawn at its end, such as a chapter's
   * time, the URL of a picture drawn at its start, and short badges drawn
   * after the text, such as "AD" on an audio description track.
   */
  readonly items: ReadonlyArray<
    readonly [string, string, (string | undefined)?, (string | undefined)?, (readonly string[])?]
  >;
  readonly value: string;
  readonly onSelect: (value: string) => void;
  /**
   * The badges drawn as a glyph, by their text. The text stays in the
   * badge for a screen reader and as its tooltip.
   */
  readonly badgeGlyphs?: Readonly<Record<string, () => SVGSVGElement>>;
}

/** An entry that opens a page of groups, with a Back at its top. */
export interface MenuPage {
  readonly name: string;
  readonly label: string;
  readonly entries: readonly MenuEntry[];
  /** A glyph drawn before the label of the item that opens the page. */
  readonly glyph?: () => SVGSVGElement;
  /** A detail drawn at the end of that item, such as the value chosen on the page. */
  readonly detail?: string;
}

export type MenuEntry = MenuGroup | MenuPage;

export interface MenuOptions {
  /** The element the menu belongs to: it carries `open`, and a pointer inside it is not outside. */
  readonly host: HTMLElement;
  /** The picture, in viewport pixels, which the popup never leaves. */
  readonly picture: () => DOMRect | null;
  /**
   * The player, whose whole box a compact player's sheet fills from the
   * foot. The box can be taller than the picture: a video letterboxed in
   * its player leaves bars the controls sit over. The menu watches its
   * size while it is open.
   */
  readonly frame: () => Element | null;
  /** The name of the Back item, from the page it leaves: "Back from {page}". */
  readonly back: (page: string) => string;
}

export interface Menu {
  readonly button: HTMLButtonElement;
  readonly popup: HTMLElement;
  /** The dim over the picture behind a compact player's sheet. A press on it closes the menu. */
  readonly backdrop: HTMLElement;
  /** The accessible name of the button and the popup. */
  label(text: string): void;
  /** Replaces the entries, back at the first page. */
  fill(entries: readonly MenuEntry[]): void;
  close(): void;
  dispose(): void;
}

/** Air between the popup's top and the picture's. */
const AIR = 8;

/**
 * The tallest a popup grows, in pixels: the title and about seven and a half rows, so
 * the half row at the foot says the list goes on. A page sets its own
 * with `--mbx-menu-max-height`.
 */
/* In em of the menu's own font size. */
const MAX_HEIGHT = 22;

/** An item's picture. Decorative: the item's text names it. Loaded when the popup first shows it. */
function picture(url: string): HTMLImageElement {
  const node = el('img', 'item-image');
  node.alt = '';
  node.loading = 'lazy';
  node.decoding = 'async';
  node.src = url;
  return node;
}

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
  const backdrop = el('div', 'backdrop');
  backdrop.hidden = true;
  backdrop.addEventListener('click', () => {
    close();
  });

  let open = false;
  /**
   * While the menu is open it follows its player: a change of tier draws
   * the page again, as a popup or as a sheet, and a change of size places
   * it again. A page that resizes with a menu open sees it keep up.
   */
  const tiers =
    typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(() => {
          if (!open) return;
          // The rows are drawn again, so the focus goes back to one of them.
          const held = popup.contains(focused());
          render();
          if (held) (checked() ?? items()[0])?.focus();
        });
  const sizes =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          if (open) fit();
        });
  /** Whether the page drawn last was drawn for a compact player. */
  let drawnCompact = false;
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

  /**
   * The popup's height: its maximum, or the room above the button if that
   * is less, so the popup never leaves the picture. Its width: the room
   * left of its right edge.
   */
  function fit(): void {
    const compact = host.getAttribute('layout') === 'compact';
    const picture = compact
      ? (options.frame()?.getBoundingClientRect() ?? null)
      : options.picture();
    backdrop.hidden = !(open && compact && picture !== null);
    for (const node of [popup, backdrop]) {
      node.style.left = node.style.bottom = node.style.width = '';
    }
    backdrop.style.height = '';
    if (picture === null) return;
    // A compact player's menu is a sheet from the foot of the player, as wide
    // as the player and never taller, over the controls. It stays inside the
    // player: a page around a small player keeps its own space. The dim
    // covers the rest of the player.
    if (compact) {
      const box = host.getBoundingClientRect();
      for (const node of [popup, backdrop]) {
        node.style.left = `${picture.left - box.left}px`;
        node.style.bottom = `${box.bottom - picture.bottom}px`;
        node.style.width = `${picture.width}px`;
      }
      backdrop.style.height = `${picture.height}px`;
      popup.style.maxHeight = `${Math.max(0, Math.floor(picture.height - AIR))}px`;
      popup.style.maxWidth = '';
      return;
    }
    const room = button.getBoundingClientRect().top - picture.top - AIR;
    const most =
      Number.parseFloat(getComputedStyle(host).getPropertyValue('--mbx-menu-max-height')) ||
      MAX_HEIGHT * (Number.parseFloat(getComputedStyle(host).fontSize) || 16);
    popup.style.maxHeight = `${Math.max(0, Math.floor(Math.min(most, room)))}px`;
    // The popup is anchored at the host's right edge and grows leftwards.
    const wide = host.getBoundingClientRect().right - picture.left - AIR;
    popup.style.maxWidth = `${Math.max(0, Math.floor(wide))}px`;
  }

  function clear(): void {
    for (const item of items()) {
      const handler = handlers.get(item);
      if (handler !== undefined) item.removeEventListener('click', handler);
    }
    setChildren(popup);
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
    // The first page starts with the menu's name. On a compact player the
    // menu is a sheet over the controls, so the name is the way back: a
    // press on it closes the sheet. Elsewhere it is a title, and the popup
    // already carries the name for a screen reader.
    drawnCompact = host.getAttribute('layout') === 'compact';
    if (stack.length === 1 && name !== '' && drawnCompact) {
      const leave = item('item back-item', name, () => {
        close();
        button.focus();
      });
      leave.setAttribute('role', 'menuitem');
      leave.setAttribute('aria-label', options.back(name));
      popup.append(leave);
    } else if (stack.length === 1 && name !== '') {
      const title = el('div', 'title', name);
      title.setAttribute('aria-hidden', 'true');
      popup.append(title);
    }
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
        if (entry.glyph !== undefined) {
          link.prepend(entry.glyph());
          state(link, `item page-item ${entry.name}-item`, { 'glyph-item': true });
        }
        if (entry.detail !== undefined) link.append(el('span', 'item-detail', entry.detail));
        popup.append(link);
        continue;
      }
      const section = el('div', `section ${entry.name}-section`);
      section.setAttribute('role', 'group');
      if (entry.label !== undefined) {
        section.setAttribute('aria-label', entry.label);
        if (entry.hideLabel !== true) {
          section.append(el('div', `section-label ${entry.name}-label`, entry.label));
        }
      }
      for (const [id, text, detail, image, badges] of entry.items) {
        const choice = item(`item ${entry.name}-item`, text, () => {
          close();
          button.focus();
          entry.onSelect(id);
        });
        for (const badge of badges ?? []) {
          const glyph = entry.badgeGlyphs?.[badge];
          if (glyph === undefined) {
            choice.append(el('span', 'item-badge', badge));
            continue;
          }
          // The glyph is what a viewer sees, and the text is what a screen reader says.
          const drawn = el('span', 'item-badge item-glyph');
          drawn.title = badge;
          drawn.append(glyph(), el('span', 'badge-text', badge));
          choice.append(drawn);
        }
        if (detail !== undefined) choice.append(el('span', 'item-detail', detail));
        if (image !== undefined) {
          // The text in a box of its own, so a long title ends in an ellipsis beside the picture.
          const [, ...rest] = choice.childNodes;
          setChildren(choice, el('span', 'item-text', text), ...rest);
          choice.prepend(picture(image));
        }
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
    tiers?.disconnect();
    sizes?.disconnect();
    popup.hidden = true;
    backdrop.hidden = true;
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
    // The tier may have changed since the page was drawn: its first row differs.
    if ((host.getAttribute('layout') === 'compact') !== drawnCompact) render();
    popup.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    host.setAttribute('open', '');
    document.addEventListener('pointerdown', outside, true);
    tiers?.observe(host, { attributes: true, attributeFilter: ['layout'] });
    const frame = options.frame();
    if (frame !== null) sizes?.observe(frame);
    fit();
    (checked() ?? items()[0])?.focus();
  }

  function toggle(): void {
    if (open) close();
    else show();
  }

  function key(event: KeyboardEvent): void {
    // Handled already, by a handler that decides first.
    if (event.defaultPrevented) return;
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
    backdrop,
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
