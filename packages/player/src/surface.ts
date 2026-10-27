/**
 * The error surface under native controls: a row under the video with the
 * category, the code and a retry. It outlives a session, because the core
 * reports "no handler claimed this source" when there is no session to
 * hang it on. It stays hidden until a fatal error arrives, and under
 * custom controls the error screen element carries the error instead.
 */
import type { PlayerError } from '@mattebox/player-core';
import { el } from './dom.js';

export interface ErrorSurface {
  readonly root: HTMLElement;
  show(error: PlayerError): void;
  /** Shows a block's words, with no retry: a retry cannot lift a block. */
  inform(title: string, message: string): void;
  clear(): void;
}

/** `word` names the retry, in the player's language at the time of the error. */
export function errorSurface(retry: () => void, word: () => string): ErrorSurface {
  const root = el('div', 'error');
  const category = el('span', 'value error-category');
  const code = el('span', 'value error-code');
  const button = el('button', 'button error-retry');
  button.type = 'button';
  button.addEventListener('click', retry);
  root.append(category, code, button);
  root.hidden = true;

  return {
    root,
    show(error: PlayerError): void {
      category.textContent = error.category;
      code.textContent = error.code;
      button.textContent = word();
      button.hidden = false;
      root.hidden = false;
    },
    inform(title: string, message: string): void {
      category.textContent = title;
      code.textContent = message;
      button.hidden = true;
      root.hidden = false;
    },
    clear(): void {
      root.hidden = true;
    },
  };
}
