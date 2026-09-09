/**
 * What sits over the picture, apart from the bar: the start button and the
 * error screen. Both live in the stage, so they are inside fullscreen and
 * over the poster, and both are the bar's, mounted and dropped with it.
 *
 * The start button is the large play in the middle of the picture: shown
 * while the video is paused, a replay once it has ended, gone while it
 * plays. The error screen replaces the row under the video: the category
 * and the code, and a retry.
 */
import type { PlayerError } from '@mattebox/player-core';
import { el } from '../dom.js';
import type { Control, Flag } from './control.js';
import type { IconName } from './icons.js';
import { glyph, icon } from './icons.js';

/** `shown` false keeps it out entirely, which is what the `start` knob at zero asks. */
export function startButton(video: HTMLVideoElement, flag: Flag, shown = true): Control {
  const root = el('button', 'control start-button');
  root.type = 'button';
  const svg = icon('play');
  root.append(svg);

  function render(): void {
    const paused = video.paused;
    const name: IconName = video.ended ? 'replay' : 'play';
    glyph(svg, name);
    root.setAttribute('aria-label', video.ended ? 'Replay' : 'Play');
    root.hidden = !shown || !paused;
    flag('paused', paused);
  }

  function click(): void {
    video.play().catch(() => undefined);
  }

  const names = ['play', 'pause', 'ended', 'emptied'];
  root.addEventListener('click', click);
  for (const name of names) video.addEventListener(name, render);
  render();

  return {
    root,
    dispose(): void {
      root.removeEventListener('click', click);
      for (const name of names) video.removeEventListener(name, render);
      root.remove();
    },
  };
}

export interface ErrorScreen extends Control {
  show(error: PlayerError): void;
  clear(): void;
  /** Whether an error is on screen, so the start button stays out of its way. */
  shown(): boolean;
}

export function errorScreen(retry: () => void): ErrorScreen {
  const root = el('div', 'error-screen');
  root.setAttribute('role', 'alert');
  const box = el('div', 'error-box');
  const title = el('div', 'error-title', 'Playback failed');
  const category = el('span', 'value error-category');
  const code = el('span', 'value error-code');
  const detail = el('div', 'error-detail');
  detail.append(category, el('span', 'error-separator', ' · '), code);
  const button = el('button', 'control error-retry', 'Retry');
  button.type = 'button';
  button.addEventListener('click', retry);
  box.append(title, detail, button);
  root.append(box);
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
    shown(): boolean {
      return !root.hidden;
    },
    dispose(): void {
      button.removeEventListener('click', retry);
      root.remove();
    },
  };
}
