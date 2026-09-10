/**
 * <mbx-control-bar>: an overlay over the bottom of the video that lays its
 * children out in two rows, the seek row over the buttons row. A child
 * with `slot="seek"` sits in the seek row; everything else in the buttons
 * row, in its order, and an <mbx-spacer> pushes what follows to the right.
 *
 * The bar owns what no one control can: the idle fade, the shortcuts, the
 * click on the video, and the subtitles lifted above it. It sets `idle` on
 * itself and on the player while it hides.
 *
 * The fade is one timer. Any activity, a pointer moving or pressing, a
 * key, playback starting, re-arms it for `idle-ms`, and when it fires the
 * bar hides unless something it can know for certain holds it: the video
 * is paused, a descendant carries `open`, or keyboard focus is inside it,
 * where keyboard means the last input was a key and not a pointer.
 * Whether the pointer is over the player is never tracked: that goes
 * stale when the pointer leaves without a move the player sees.
 *
 * The shortcuts listen on the player, so they hear every key pressed
 * inside it, and only there: Space and `k` toggle play, `m` mutes, `f`
 * toggles fullscreen, the arrows seek by `seek-step`. Space is left to a
 * focused button, which is its own. A click on the video toggles play.
 * Fullscreen goes on the player itself, so the bar comes along.
 */

import type { CueLift } from '../controls/cues.js';
import { cueLift, cueStyle } from '../controls/cues.js';
import type { Fullscreen } from '../controls/fullscreen.js';
import { fullscreen } from '../controls/fullscreen.js';
import type { PlayerHost } from '../host.js';
import { Component } from './component.js';
import { number, style } from './shared.js';

const IDLE_MS = 3000;
const SEEK_STEP = 5;

const STYLE = `
:host {
  position: absolute;
  inset: auto 0 0 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 40px 16px 12px;
  color: var(--mbx-text);
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
  font: 500 16px/1.2 var(--mbx-font);
  transition: opacity 0.2s;
}
:host([idle]) { opacity: 0; pointer-events: none; }
[part~="row"] { display: flex; align-items: center; gap: 8px; }
[part~="seek-row"] { gap: 16px; }
@media (prefers-reduced-motion: reduce) {
  :host { transition: none; }
}
`;

function end(video: HTMLVideoElement): number {
  if (Number.isFinite(video.duration)) return video.duration;
  const ranges = video.seekable;
  return ranges.length > 0 ? ranges.end(ranges.length - 1) : video.currentTime;
}

function toggle(video: HTMLVideoElement): void {
  if (video.paused) video.play().catch(() => undefined);
  else video.pause();
}

export class MbxControlBar extends Component {
  static get observedAttributes(): readonly string[] {
    return ['idle-ms', 'seek-step'];
  }

  declare private readonly seekRow: HTMLDivElement;
  declare private timer: ReturnType<typeof setTimeout> | undefined;
  /** Whether the last input was a key, so focus inside holds the bar. */
  declare private keyboard: boolean;
  declare private cues: CueLift | null;
  declare private screen: Fullscreen | null;

  constructor() {
    super();
    this.timer = undefined;
    this.keyboard = false;
    this.cues = null;
    this.screen = null;
    const root = this.attachShadow({ mode: 'open' });
    this.seekRow = document.createElement('div');
    this.seekRow.setAttribute('part', 'row seek-row');
    const seek = document.createElement('slot');
    seek.name = 'seek';
    this.seekRow.append(seek);
    const buttons = document.createElement('div');
    buttons.setAttribute('part', 'row buttons-row');
    buttons.append(document.createElement('slot'));
    root.append(style(STYLE), this.seekRow, buttons);
  }

  /** From the first row's top to the bar's bottom: what the bar covers of the picture. */
  private covered(): { top: number; bottom: number } {
    return {
      top: this.seekRow.getBoundingClientRect().top,
      bottom: this.getBoundingClientRect().bottom,
    };
  }

  private held(player: PlayerHost): boolean {
    if (player.video.paused) return true;
    if (this.querySelector('[open]') !== null) return true;
    if (!this.keyboard) return false;
    const active = (this.getRootNode() as Document | ShadowRoot).activeElement;
    return active !== null && this.contains(active);
  }

  private idle(player: PlayerHost, on: boolean): void {
    if (this.hasAttribute('idle') === on) return;
    this.toggleAttribute('idle', on);
    player.toggleAttribute('idle', on);
    this.cues?.lifted(!on);
  }

  private sleep(player: PlayerHost): void {
    this.timer = undefined;
    // A hold is checked again later: a menu closes and a pause ends without
    // an event the bar hears.
    if (this.held(player)) {
      this.timer = setTimeout(() => this.sleep(player), number(this, 'idle-ms', IDLE_MS));
      return;
    }
    this.idle(player, true);
  }

  private wake(player: PlayerHost): void {
    clearTimeout(this.timer);
    this.idle(player, false);
    this.timer = setTimeout(() => this.sleep(player), number(this, 'idle-ms', IDLE_MS));
  }

  private key(player: PlayerHost, event: KeyboardEvent): void {
    this.keyboard = true;
    this.wake(player);
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const video = player.video;
    const onButton = event.composedPath()[0] instanceof HTMLButtonElement;
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
        this.screen?.toggle();
        break;
      case 'ArrowLeft':
        video.currentTime = Math.max(0, video.currentTime - number(this, 'seek-step', SEEK_STEP));
        break;
      case 'ArrowRight':
        video.currentTime = Math.min(
          end(video),
          video.currentTime + number(this, 'seek-step', SEEK_STEP),
        );
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  protected override attach(player: PlayerHost): void {
    const video = player.video;
    cueStyle();
    this.cues = cueLift(video, player, () => this.covered());
    const screen = fullscreen(player, video);
    this.screen = screen;
    const reflect = (): void => {
      player.toggleAttribute('fullscreen', screen.active());
    };
    this.keep(screen.watch(reflect));
    reflect();

    const pointer = (): void => {
      this.keyboard = false;
      this.wake(player);
    };
    const key = (event: Event): void => {
      this.key(player, event as KeyboardEvent);
    };
    const click = (event: Event): void => {
      // The video and nothing else: a control handles its own click.
      if (event.composedPath()[0] === video) toggle(video);
    };
    this.listen(player, ['pointermove', 'pointerdown'], pointer);
    player.addEventListener('keydown', key);
    player.addEventListener('click', click);
    this.keep(() => {
      player.removeEventListener('keydown', key);
      player.removeEventListener('click', click);
    });
    this.listen(video, ['play', 'pause', 'ended'], () => {
      this.wake(player);
    });
    this.wake(player);
    this.cues.lifted(true);
  }

  protected override detach(player: PlayerHost): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.cues?.dispose();
    this.cues = null;
    this.screen = null;
    this.removeAttribute('idle');
    player.removeAttribute('idle');
    player.removeAttribute('fullscreen');
  }
}
