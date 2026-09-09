/**
 * The live button: a dot and the word, the dot red at the edge and grey
 * behind it, the way viewers read it everywhere. Shown once the stream has
 * an availability window, which is what makes it live; disabled at the
 * edge, where there is nowhere to go; a click seeks to the edge. The same
 * test the live panel uses.
 *
 * Without a seek bar, when the window is too narrow to be worth one, there
 * is nowhere to come back from either: the dot stays red and the button
 * stays inert, whatever the playhead does.
 */
import { el, state } from '../dom.js';
import type { LiveApi } from '../namespaces.js';
import type { Control } from './control.js';

export interface LiveButton extends Control {
  attach(live: LiveApi | undefined): void;
  detach(): void;
  /** Whether the stream has a seek bar. Without one the button only says live. */
  seekable(on: boolean): void;
}

export function liveButton(video: HTMLVideoElement): LiveButton {
  const root = el('button', 'control live-button');
  root.type = 'button';
  const dot = el('span', 'live-dot');
  root.append(dot, el('span', 'live-text', 'LIVE'));
  root.setAttribute('aria-label', 'Go to the live edge');
  root.hidden = true;
  let live: LiveApi | undefined;
  let bar = true;

  function tick(): void {
    const on = live !== undefined && live.edge !== null;
    root.hidden = !on;
    if (!on) return;
    const atEdge = !bar || live?.atEdge === true;
    root.disabled = atEdge;
    state(root, 'control live-button', { 'at-edge': atEdge });
    state(dot, 'live-dot', { 'at-edge': atEdge });
    root.setAttribute('aria-label', atEdge ? 'At the live edge' : 'Go to the live edge');
  }

  function click(): void {
    live?.seekToEdge();
  }

  root.addEventListener('click', click);
  video.addEventListener('timeupdate', tick);
  tick();

  return {
    root,
    attach(found: LiveApi | undefined): void {
      live = found;
      tick();
    },
    detach(): void {
      live = undefined;
      tick();
    },
    seekable(on: boolean): void {
      bar = on;
      tick();
    },
    dispose(): void {
      root.removeEventListener('click', click);
      video.removeEventListener('timeupdate', tick);
    },
  };
}
