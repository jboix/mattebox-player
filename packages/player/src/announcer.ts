/**
 * The live region: what changed on the player, said to a screen reader.
 * A shortcut key or a remote changes the playback with no focused control
 * to read, so the element says it here: play, pause, loading, a fatal
 * error and a track change (WCAG 2.2 SC 4.1.3, Status Messages). Vidstack's
 * media announcer says the same things.
 *
 * Every phrase is an attribute on the player, `label-playing`,
 * `label-paused`, `label-loading`, `label-error`, `label-audio`,
 * `label-subtitles` and `label-subtitles-off`; `{track}` in the last
 * three's text is the track's name. Without the attribute, the phrase
 * comes from the player's language, else English. `announce="off"` keeps
 * it quiet, for a page that announces on its own.
 */
import { el } from './dom.js';
import { fill } from './labels.js';
import type { Messages } from './messages.js';

export interface Announcer {
  readonly root: HTMLElement;
  /** Says the phrase of `label-<name>`, else the language's `id`, else `fallback`. */
  say(name: string, id: keyof Messages, fallback: string, track?: string): void;
  /** Says `text` as it is: words the page gave, such as a block's. */
  tell(text: string): void;
}

/**
 * A screen reader reads a live region when its text changes, so the same
 * phrase twice in a row, such as two pauses, has to empty the region
 * first. The delay lets the reader see the empty region.
 */
const REFILL_MS = 100;

export function announcer(
  host: HTMLElement,
  word: (id: keyof Messages) => string | undefined,
): Announcer {
  const root = el('div', 'announcer');
  root.setAttribute('role', 'status');
  // role="status" implies it; some older screen readers read only the attribute.
  root.setAttribute('aria-live', 'polite');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tell = (text: string): void => {
    if (host.getAttribute('announce') === 'off') return;
    root.textContent = '';
    clearTimeout(timer);
    timer = setTimeout(() => {
      root.textContent = text;
    }, REFILL_MS);
  };
  return {
    root,
    say(name, id, fallback, track = '') {
      tell(fill(host.getAttribute(`label-${name}`) ?? word(id) ?? fallback, { track }));
    },
    tell,
  };
}
