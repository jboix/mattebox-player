/**
 * The buttons: play/pause, mute, fullscreen. Each reads the video on the
 * events the video already fires, swaps its glyph and its name, and writes
 * one thing back on click. The glyph is decoration; the name is on the
 * button, where a screen reader reads it.
 */
import { el } from '../dom.js';
import type { Control, Flag } from './control.js';
import type { Fullscreen } from './fullscreen.js';
import type { IconName } from './icons.js';
import { glyph, icon } from './icons.js';
import type { PictureInPicture } from './pip.js';

/** A button with its glyph. `control` is the generic name, so `::part(control)` reaches every one. */
export function button(name: string, first: IconName): [HTMLButtonElement, SVGSVGElement] {
  const node = el('button', `control ${name}-button`);
  node.type = 'button';
  const svg = icon(first);
  node.append(svg);
  return [node, svg];
}

function listen(target: EventTarget, names: readonly string[], fn: () => void): () => void {
  for (const name of names) target.addEventListener(name, fn);
  return () => {
    for (const name of names) target.removeEventListener(name, fn);
  };
}

export function playButton(video: HTMLVideoElement, flag: Flag): Control {
  const [root, svg] = button('play', 'play');

  function render(): void {
    const paused = video.paused;
    const name: IconName = video.ended ? 'replay' : paused ? 'play' : 'pause';
    glyph(svg, name);
    root.setAttribute('aria-label', video.ended ? 'Replay' : paused ? 'Play' : 'Pause');
    flag('playing', !paused);
  }

  function click(): void {
    if (video.paused) {
      // Rejected outside a user gesture on an unmuted video, which the
      // browser reports on the video's own error path; nothing to add.
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }

  root.addEventListener('click', click);
  const off = listen(video, ['play', 'pause', 'ended', 'emptied'], render);
  render();

  return {
    root,
    dispose(): void {
      root.removeEventListener('click', click);
      off();
    },
  };
}

export function muteButton(video: HTMLVideoElement, flag: Flag): Control {
  const [root, svg] = button('mute', 'volume-high');

  function render(): void {
    const silent = video.muted || video.volume === 0;
    const name: IconName = silent ? 'mute' : video.volume <= 0.5 ? 'volume-low' : 'volume-high';
    glyph(svg, name);
    root.setAttribute('aria-label', silent ? 'Unmute' : 'Mute');
    root.setAttribute('aria-pressed', String(video.muted));
    flag('muted', silent);
  }

  function click(): void {
    if (video.muted) {
      video.muted = false;
      // Unmuting at zero volume would change nothing the viewer can hear.
      if (video.volume === 0) video.volume = 1;
    } else {
      video.muted = true;
    }
  }

  root.addEventListener('click', click);
  const off = listen(video, ['volumechange', 'emptied'], render);
  render();

  return {
    root,
    dispose(): void {
      root.removeEventListener('click', click);
      off();
    },
  };
}

/** The glyph for a skip amount: the set draws 10 and 30, and a plain arrow says the rest. */
function skipGlyph(back: boolean, amount: number): IconName {
  const side = back ? 'seek-backward' : 'seek-forward';
  if (amount === 10 || amount === 30) return `${side}-${amount}`;
  return side;
}

/** Moves the playhead by `seconds`, negative for back, within what the video can reach. */
export function skipButton(video: HTMLVideoElement, seconds: number): Control {
  const back = seconds < 0;
  const amount = Math.abs(seconds);
  const [root] = button(back ? 'skip-back' : 'skip-forward', skipGlyph(back, amount));
  root.setAttribute('aria-label', `${back ? 'Back' : 'Forward'} ${amount} seconds`);

  function click(): void {
    const ranges = video.seekable;
    const end = Number.isFinite(video.duration)
      ? video.duration
      : ranges.length > 0
        ? ranges.end(ranges.length - 1)
        : video.currentTime;
    video.currentTime = Math.min(end, Math.max(0, video.currentTime + seconds));
  }

  root.addEventListener('click', click);
  return {
    root,
    dispose(): void {
      root.removeEventListener('click', click);
    },
  };
}

export function pipButton(api: PictureInPicture, flag: Flag): Control {
  const [root, svg] = button('pip', 'picture-in-picture');
  root.hidden = !api.supported;

  function render(): void {
    const active = api.active();
    glyph(svg, active ? 'picture-in-picture-exit' : 'picture-in-picture');
    root.setAttribute('aria-label', active ? 'Leave picture in picture' : 'Picture in picture');
    flag('pip', active);
  }

  root.addEventListener('click', api.toggle);
  const off = api.watch(render);
  render();

  return {
    root,
    dispose(): void {
      root.removeEventListener('click', api.toggle);
      off();
    },
  };
}

export function fullscreenButton(api: Fullscreen, flag: Flag): Control {
  const [root, svg] = button('fullscreen', 'fullscreen');
  root.hidden = !api.supported;

  function render(): void {
    const active = api.active();
    glyph(svg, active ? 'fullscreen-exit' : 'fullscreen');
    root.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
    flag('fullscreen', active);
  }

  root.addEventListener('click', api.toggle);
  const off = api.watch(render);
  render();

  return {
    root,
    dispose(): void {
      root.removeEventListener('click', api.toggle);
      off();
    },
  };
}
