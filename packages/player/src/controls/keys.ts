/**
 * The shortcuts, live only while focus is inside the element: Space and `k`
 * toggle play, `m` mutes, `f` toggles fullscreen, the arrows seek by the
 * step. They listen on the host, where every key pressed inside the
 * element arrives, and they stand aside twice. A key a control has already
 * handled arrives with its default prevented, so the seek bar's arrows are
 * not seeking twice. And Space on a button is the button's own activation,
 * so it is left to the button.
 *
 * A click on the video toggles play, the way a viewer expects of a player,
 * and only there: clicks on the bar, the start button and the error screen
 * are theirs.
 */
import type { Control } from './control.js';
import type { Fullscreen } from './fullscreen.js';

export interface KeysOptions {
  readonly host: HTMLElement;
  readonly stage: HTMLElement;
  /** What sits over the picture and takes its own clicks. */
  readonly own: readonly HTMLElement[];
  readonly video: HTMLVideoElement;
  readonly step: number;
  readonly fullscreen: Fullscreen;
}

function toggle(video: HTMLVideoElement): void {
  if (video.paused) video.play().catch(() => undefined);
  else video.pause();
}

/** The end the playhead can reach: the duration, or the seekable end for live. */
function end(video: HTMLVideoElement): number {
  if (Number.isFinite(video.duration)) return video.duration;
  const ranges = video.seekable;
  return ranges.length > 0 ? ranges.end(ranges.length - 1) : video.currentTime;
}

export function keys(options: KeysOptions): Control {
  const { host, stage, own, video } = options;

  function onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.composedPath()[0];
    const onButton = target instanceof HTMLButtonElement;
    switch (event.key) {
      case ' ':
        if (onButton) return;
        toggle(video);
        break;
      case 'k':
      case 'K':
        toggle(video);
        break;
      case 'm':
      case 'M':
        video.muted = !video.muted;
        break;
      case 'f':
      case 'F':
        options.fullscreen.toggle();
        break;
      case 'ArrowLeft':
        video.currentTime = Math.max(0, video.currentTime - options.step);
        break;
      case 'ArrowRight':
        video.currentTime = Math.min(end(video), video.currentTime + options.step);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function onClick(event: MouseEvent): void {
    const path = event.composedPath();
    if (own.some((node) => path.includes(node))) return;
    toggle(video);
  }

  host.addEventListener('keydown', onKey);
  stage.addEventListener('click', onClick);

  return {
    root: stage,
    dispose(): void {
      host.removeEventListener('keydown', onKey);
      stage.removeEventListener('click', onClick);
    },
  };
}
