/**
 * The demo page, mounted inside the test page. `mount` puts the demo's own
 * markup in the document, runs the head's inline theme script, and imports a
 * fresh instance of the demo's script, so every test starts on the page a
 * visitor gets. The options replace the query string the hosted page reads.
 */
import type { MatteboxPlayerElement } from '@mattebox/player';
import html from '../../demo/index.html?raw';
import '../../demo/src/style.css';

export interface MountOptions {
  /**
   * What plays on arrival: the demo's `?row=` query. `none` waits for a
   * choice, so nothing from the internet is in flight under a test.
   */
  readonly row?: number | 'none';
}

export interface Demo {
  /** The first match, or a throw: a test names what it expects to be there. */
  readonly $: <T extends Element = HTMLElement>(selector: string, root?: ParentNode) => T;
  readonly $$: <T extends Element = HTMLElement>(selector: string, root?: ParentNode) => T[];
  /** The element on the page now: a route with keys swaps it. */
  readonly player: () => MatteboxPlayerElement;
  /** The element's own bar, under custom controls. */
  readonly bar: () => HTMLElement;
  /** The page again, keeping what it saved: what a reload does. */
  readonly remount: () => Promise<Demo>;
}

/** Visible the way a pointer sees it: a box, and not `visibility: hidden`. */
export function visible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
}

/** What a control's shadow button is called. */
export function accessibleName(element: Element): string {
  return element.shadowRoot?.querySelector('button')?.getAttribute('aria-label') ?? '';
}

const page = new DOMParser().parseFromString(html, 'text/html');

/** One import per mount: the demo's script runs on import, and holds the page's state. */
let mounts = 0;

function query<T extends Element>(selector: string, root: ParentNode): T {
  const node = root.querySelector<T>(selector);
  if (node === null) throw new Error(`${selector} is not on the page`);
  return node;
}

async function load(options: MountOptions): Promise<Demo> {
  document.body.replaceChildren(
    ...[...page.body.children]
      .filter((child) => !(child instanceof HTMLScriptElement))
      .map((child) => document.importNode(child, true)),
  );
  // The theme script in the head runs before the first paint on the hosted
  // page; a script imported into the document runs the same way.
  for (const inline of page.head.querySelectorAll('script:not([src])')) {
    const script = document.createElement('script');
    script.textContent = inline.textContent;
    document.head.append(script);
    script.remove();
  }
  // The demo reads its arrival row from the query string, so the option goes
  // there for the import and comes off again after: the test page's own
  // parameters stay as they were.
  const before = location.href;
  const url = new URL(before);
  if (options.row === undefined) url.searchParams.delete('row');
  else url.searchParams.set('row', String(options.row));
  history.replaceState(history.state, '', url);
  try {
    mounts += 1;
    await import(/* @vite-ignore */ `/demo/src/main.ts?mount=${mounts}`);
  } finally {
    history.replaceState(history.state, '', before);
  }
  const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T =>
    query<T>(selector, root);
  const $$ = <T extends Element = HTMLElement>(
    selector: string,
    root: ParentNode = document,
  ): T[] => [...root.querySelectorAll<T>(selector)];
  return {
    $,
    $$,
    player: () => $<MatteboxPlayerElement>('mattebox-player'),
    bar: () => $('mattebox-player > mbx-control-bar'),
    remount: () => load(options),
  };
}

/** The demo page as a first visit: nothing saved, the system's theme. */
export async function mount(options: MountOptions = {}): Promise<Demo> {
  unmount();
  return load(options);
}

/** Takes the page down and forgets what it saved, so the next mount is a first visit. */
export function unmount(): void {
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-theme');
  localStorage.clear();
}
