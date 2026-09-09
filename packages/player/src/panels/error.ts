/**
 * The error surface. It is not a panel: it outlives a session, because the
 * core reports "no handler claimed this source" when there is no session to
 * hang it on. It stays hidden until a fatal error arrives.
 */
import type { PlayerError } from '@mattebox/player-core';
import { el } from '../dom.js';

export interface ErrorSurface {
  readonly root: HTMLElement;
  show(error: PlayerError): void;
  clear(): void;
}

export function errorSurface(retry: () => void): ErrorSurface {
  const root = el('div', 'panel error');
  const category = el('span', 'value error-category');
  const code = el('span', 'value error-code');
  const button = el('button', 'button error-retry', 'Retry');
  button.type = 'button';
  button.addEventListener('click', retry);
  root.append(category, code, button);
  root.hidden = true;

  return {
    root,
    show(error: PlayerError): void {
      category.textContent = error.category;
      code.textContent = error.code;
      root.hidden = false;
    },
    clear(): void {
      root.hidden = true;
    },
  };
}
