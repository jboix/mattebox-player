/**
 * The demo pages' logs. Each line is a row with its time, its kind and its
 * text, newest last. The list follows new lines while you are at its
 * bottom, and stays where you scrolled otherwise. "Expand" opens the same
 * lines in a dialog the size of the window, with a filter and a copy button.
 */

export type Level = 'info' | 'warn' | 'error';

export interface EventLog {
  write(kind: string, text: string, level?: Level): void;
  clear(): void;
}

interface Line {
  readonly time: string;
  readonly kind: string;
  readonly text: string;
  readonly level: Level;
}

/** Lines kept, in the panel and in the dialog. */
const LIMIT = 500;

function stamp(): string {
  const now = new Date();
  const pad = (n: number, width = 2): string => String(n).padStart(width, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text: string): HTMLButtonElement {
  const node = element('button', 'log-button', text);
  node.type = 'button';
  return node;
}

function row(line: Line): HTMLLIElement {
  const item = element('li', `log-row lvl-${line.level}`);
  item.append(
    element('span', 'log-time', line.time),
    element('span', 'log-kind', line.kind),
    element('span', 'log-text', line.text),
  );
  return item;
}

/** Within a few pixels of the end: the list follows the next line. */
function atBottom(list: HTMLElement): boolean {
  return list.scrollHeight - list.scrollTop - list.clientHeight < 4;
}

function append(list: HTMLElement, item: HTMLElement): void {
  const follow = atBottom(list);
  list.append(item);
  while (list.childElementCount > LIMIT) list.firstElementChild?.remove();
  if (follow) list.scrollTop = list.scrollHeight;
}

/** Builds a log in `host`, which it empties, and its dialog, named `title`. */
export function eventLog(host: HTMLElement, title: string): EventLog {
  const lines: Line[] = [];
  let filter = '';

  const count = element('span', 'log-count');
  const clear = button('Clear');
  const expand = button('Expand');
  const bar = element('div', 'log-bar');
  bar.append(count, clear, expand);
  const list = element('ol', 'log-lines');
  list.setAttribute('role', 'log');
  list.setAttribute('aria-label', title);
  host.classList.add('event-log');
  host.replaceChildren(bar, list);

  const dialog = element('dialog', 'log-dialog');
  dialog.setAttribute('aria-label', title);
  const heading = element('h2', 'log-title', title);
  const search = element('input', 'log-filter');
  search.type = 'search';
  search.placeholder = 'Filter';
  search.setAttribute('aria-label', `Filter the ${title.toLowerCase()}`);
  const shown = element('span', 'log-count');
  const copy = button('Copy');
  const clearAll = button('Clear');
  const close = button('Close');
  const head = element('div', 'log-head');
  head.append(heading, search, shown, copy, clearAll, close);
  const big = element('ol', 'log-lines');
  dialog.append(head, big);
  document.body.append(dialog);

  const matches = (line: Line): boolean =>
    filter === '' || `${line.kind} ${line.text}`.toLowerCase().includes(filter);
  const counts = (): void => {
    const total = `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`;
    count.textContent = total;
    shown.textContent =
      filter === '' ? total : `${lines.filter(matches).length} of ${lines.length}`;
  };
  const render = (): void => {
    big.replaceChildren(...lines.filter(matches).map(row));
    big.scrollTop = big.scrollHeight;
    counts();
  };
  const empty = (): void => {
    lines.length = 0;
    list.replaceChildren();
    big.replaceChildren();
    counts();
  };

  clear.addEventListener('click', empty);
  clearAll.addEventListener('click', empty);
  expand.addEventListener('click', () => {
    render();
    dialog.showModal();
  });
  close.addEventListener('click', () => dialog.close());
  // A click on the backdrop, which is the dialog itself and not its content, closes it.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  search.addEventListener('input', () => {
    filter = search.value.trim().toLowerCase();
    render();
  });
  copy.addEventListener('click', () => {
    const text = lines
      .filter(matches)
      .map((line) => `${line.time}  ${line.kind}  ${line.text}`)
      .join('\n');
    void navigator.clipboard?.writeText(text).then(() => {
      copy.textContent = 'Copied';
      setTimeout(() => {
        copy.textContent = 'Copy';
      }, 1500);
    });
  });
  counts();

  return {
    write(kind, text, level = 'info') {
      const line: Line = { time: stamp(), kind, text, level };
      lines.push(line);
      if (lines.length > LIMIT) lines.shift();
      append(list, row(line));
      if (dialog.open && matches(line)) append(big, row(line));
      counts();
    },
    clear: empty,
  };
}
