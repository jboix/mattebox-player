/**
 * The control bar: an overlay over the bottom of the video, mounted while
 * `controls="custom"` and nothing else. Two rows. The seek row is the time,
 * the bar, the duration, and the live button. The buttons row is whatever
 * the `layout` knob names, in its order: by default skip back, play, skip
 * forward and the volume on the left; speed, the menus, picture in picture
 * and fullscreen on the right.
 *
 * The bar owns two things of its own: the state it carries on its part
 * name, and the idle fade. State rides the part name, so a page styles
 * `::part(playing)`, `::part(muted)`, `::part(fullscreen)`, `::part(live)`,
 * `::part(seekable)` and `::part(idle)`.
 *
 * The fade is one timer and nothing else. Any activity, a pointer moving or
 * pressing, a key, playback starting, re-arms it for `idleMs`, and when it
 * fires the bar hides unless something the bar can know for certain holds
 * it: the video is paused, a menu is open, or keyboard focus is inside it,
 * where keyboard means the last input was a key and not a pointer. Whether
 * the pointer is over the element is never tracked: that state goes stale
 * when the pointer leaves without a move the element sees, and a bar that
 * will not hide is worse than one that hides under a still pointer.
 *
 * Pointer events on the slotted video bubble through the slot to the stage,
 * so the stage is the one listener target, and fullscreen goes on the stage
 * too, so it is the video and the bar and nothing else. The host is where
 * the shortcuts listen, so they hear every key pressed inside.
 *
 * The menus over the engine's namespaces live per session, the way the
 * panels do: built on attach, dropped on detach, none for a native session.
 * The speed menu reads the video alone, so it is there for every session.
 *
 * While the bar shows, the subtitles are lifted above it; while it hides,
 * they return to the bottom of the video.
 *
 * Two more things sit in the stage with the bar: the start button in the
 * middle of the picture, and the error screen that takes the place of the
 * row under the video while the bar is the interface.
 */
import type { PlayerError, Session } from '@mattebox/player-core';
import { el, state } from '../dom.js';
import { namespaces } from '../namespaces.js';
import { fullscreenButton, muteButton, pipButton, playButton, skipButton } from './buttons.js';
import type { Control } from './control.js';
import { cueLift, cueStyle } from './cues.js';
import { fullscreen } from './fullscreen.js';
import { keys } from './keys.js';
import { liveButton } from './live.js';
import { MENUS } from './menus.js';
import type { Controls } from './options.js';
import { clusters } from './options.js';
import { pictureInPicture } from './pip.js';
import { errorScreen, startButton } from './screens.js';
import { seekBar } from './seek.js';
import { speedMenu } from './speed.js';
import { volumeSlider } from './volume.js';

export interface ControlBar {
  readonly root: HTMLElement;
  /** The session now feeding the video, for the parts that read its engine. */
  attach(session: Session): void;
  detach(): void;
  /** A fatal error, shown over the picture until the next load. */
  error(error: PlayerError): void;
  clearError(): void;
  dispose(): void;
}

export function controlBar(
  host: HTMLElement,
  stage: HTMLElement,
  video: HTMLVideoElement,
  options: Controls,
  /** Told of the states the host reflects, so the page can reach the light-DOM video by them. */
  reflect: (name: string, on: boolean) => void,
  /** What the error screen's retry does. */
  retry: () => void,
): ControlBar {
  const root = el('div', 'controls');
  const flags: Record<string, boolean> = {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Whether the last input was a key, so focus inside is a keyboard user's and holds the bar. */
  let keyboard = false;

  function render(): void {
    state(root, 'controls', flags);
  }

  function flag(name: string, on: boolean): void {
    if (flags[name] === on) return;
    flags[name] = on;
    render();
    if (name === 'fullscreen') reflect(name, on);
    if (name === 'idle') cues.lifted(!on);
    if (name === 'seekable') live.seekable(on);
  }

  /** What keeps the bar up when the timer fires. Read then, never remembered. */
  function held(): boolean {
    if (video.paused) return true;
    if (root.querySelector('[part~="open"]') !== null) return true;
    if (!keyboard) return false;
    const active = (root.getRootNode() as Document | ShadowRoot).activeElement;
    return active !== null && root.contains(active);
  }

  function sleep(): void {
    timer = undefined;
    // A hold is checked again later: a menu closes and a pause ends without
    // an event the bar hears.
    if (held()) {
      timer = setTimeout(sleep, options.idleMs);
      return;
    }
    flag('idle', true);
  }

  /** Shows the bar and arms the timer again. */
  function wake(): void {
    clearTimeout(timer);
    if (flags.idle === true) flag('idle', false);
    timer = setTimeout(sleep, options.idleMs);
  }

  function pointer(): void {
    keyboard = false;
    wake();
  }

  function key(): void {
    keyboard = true;
    wake();
  }

  cueStyle();
  const cues = cueLift(video, root, host);
  // The live button first: the seek row reports whether it is seekable as
  // it is built, and the flag passes that on to the button.
  const live = liveButton(video);
  const seek = seekBar(video, flag, options);
  seek.root.append(live.root);

  const screen = fullscreen(host, stage, video);
  const start = startButton(video, flag, options.start !== 0);
  const failure = errorScreen(retry);
  /** An error over a picture that then plays is wrong by definition: playback resuming clears it. */
  function played(): void {
    if (failure.shown()) {
      failure.clear();
      start.root.hidden = !video.paused;
    }
  }
  video.addEventListener('playing', played);
  stage.append(start.root, failure.root);
  /** The menus' places in the row, filled per session. */
  const slots = new Map<string, HTMLElement>();
  let session: Control[] = [];

  /** A control by the name the layout gives it, or null for a name that is not one. */
  function build(name: string): Control | null {
    switch (name) {
      case 'skip-back':
        return options.skipBack > 0 ? skipButton(video, -options.skipBack) : null;
      case 'skip-forward':
        return options.skipForward > 0 ? skipButton(video, options.skipForward) : null;
      case 'play':
        return playButton(video, flag);
      case 'volume': {
        const group = el('div', 'group volume-group');
        const sound = [muteButton(video, flag), volumeSlider(video)];
        for (const control of sound) group.append(control.root);
        return {
          root: group,
          dispose(): void {
            for (const control of sound) control.dispose();
          },
        };
      }
      case 'speed':
        return speedMenu(video);
      case 'pip':
        return pipButton(pictureInPicture(video), flag);
      case 'fullscreen':
        return fullscreenButton(screen, flag);
      default: {
        if (!(name in MENUS)) return null;
        const slot = el('div', `slot ${name}-slot`);
        slots.set(name, slot);
        return { root: slot, dispose(): void {} };
      }
    }
  }

  const row = el('div', 'row buttons');
  const cluster = el('div', 'cluster');
  const built: Control[] = [];
  const [leftNames, rightNames] = clusters(options.layout);
  for (const name of leftNames) {
    const control = build(name);
    if (control === null) continue;
    built.push(control);
    row.append(control.root);
  }
  for (const name of rightNames) {
    const control = build(name);
    if (control === null) continue;
    built.push(control);
    cluster.append(control.root);
  }
  row.append(cluster);
  root.append(seek.root, row);
  const controls: readonly Control[] = [
    ...built,
    live,
    start,
    failure,
    keys({
      host,
      stage,
      own: [root, start.root, failure.root],
      video,
      step: options.seekStep,
      fullscreen: screen,
    }),
    cues,
  ];

  function drop(): void {
    for (const control of session) control.dispose();
    session = [];
    for (const slot of slots.values()) slot.replaceChildren();
  }

  stage.addEventListener('pointermove', pointer);
  stage.addEventListener('pointerdown', pointer);
  host.addEventListener('keydown', key);
  video.addEventListener('play', wake);
  video.addEventListener('pause', wake);
  video.addEventListener('ended', wake);
  wake();
  cues.lifted(true);

  return {
    root,
    attach(current: Session): void {
      drop();
      const engine = current.engine;
      if (engine === null) {
        seek.attach({});
        live.attach(undefined);
        return;
      }
      const found = namespaces(engine);
      seek.attach({
        live: found.live,
        thumbnails: found.thumbnails,
        pdt: found.pdt,
        // The forward buffer goal and the availability window live on the
        // diagnostics snapshot and nowhere else.
        bufferGoal: () => engine.stats.snapshot().scheduling.bufferGoal,
        window: () => engine.stats.snapshot().live?.span ?? null,
      });
      live.attach(found.live);
      for (const [name, slot] of slots) {
        const factory = MENUS[name];
        if (factory === undefined) continue;
        const control = factory({ engine, host });
        session.push(control);
        slot.append(control.root);
      }
    },
    detach(): void {
      drop();
      seek.detach();
      live.detach();
    },
    error(error: PlayerError): void {
      failure.show(error);
      start.root.hidden = true;
    },
    clearError(): void {
      failure.clear();
      start.root.hidden = options.start === 0 || !video.paused;
    },
    dispose(): void {
      clearTimeout(timer);
      drop();
      seek.dispose();
      for (const control of controls) control.dispose();
      stage.removeEventListener('pointermove', pointer);
      stage.removeEventListener('pointerdown', pointer);
      host.removeEventListener('keydown', key);
      video.removeEventListener('play', wake);
      video.removeEventListener('pause', wake);
      video.removeEventListener('ended', wake);
      video.removeEventListener('playing', played);
      root.remove();
    },
  };
}
