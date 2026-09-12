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
 *
 * A narrow bar collapses the buttons row by `priority`: each child carries
 * a number, its own attribute or the default for its tag, and the bar
 * marks the highest numbers `collapsed` one at a time until the row fits
 * with a little slack, from the right among equals. Zero, the default for
 * anything unlisted, never collapses: play and fullscreen stay whatever
 * the width. The mark is an attribute and the hiding is one `::slotted`
 * rule here, so a page styles or overrides it by the tag. The volume's
 * slider is a candidate of its own, and counts at its unfolded width, so
 * the row is sized for what the pointer will make of it.
 */

import type { CueLift } from '../controls/cues.js';
import { cueLift, cueStyle } from '../controls/cues.js';
import type { Fullscreen } from '../controls/fullscreen.js';
import { fullscreen } from '../controls/fullscreen.js';
import type { PlayerHost } from '../host.js';
import {
  AUDIO_MENU,
  CHAPTERS_MENU,
  DRM_BADGE,
  MUTE_BUTTON,
  PIP_BUTTON,
  QUALITY_MENU,
  SKIP_BUTTON,
  SPACER,
  SPEED_MENU,
  SUBTITLES_MENU,
  VOLUME,
  VOLUME_SLIDER,
} from '../tags.js';
import { Component } from './component.js';
import { number, style } from './shared.js';

const IDLE_MS = 3000;
const SEEK_STEP = 5;

/**
 * What goes first when the row is too narrow, by tag: the slider, which
 * takes the most room for the least; then the diagnostics, the lock and
 * the menus a viewer rarely opens; then the menus for the picture and the
 * sound; then the skips; then the mute and the subtitles. The subtitles
 * menu goes last of the menus because it is the one a viewer may need.
 * The diagnostics is another package's, named here as a string. A
 * `priority` attribute on the control replaces its default.
 */
const PRIORITY: Readonly<Record<string, number>> = {
  [VOLUME_SLIDER]: 5,
  'mbx-diagnostics': 4,
  [DRM_BADGE]: 4,
  [SPEED_MENU]: 4,
  [CHAPTERS_MENU]: 4,
  [AUDIO_MENU]: 3,
  [QUALITY_MENU]: 3,
  [PIP_BUTTON]: 3,
  [SKIP_BUTTON]: 2,
  [SUBTITLES_MENU]: 1,
  [VOLUME]: 1,
  [MUTE_BUTTON]: 1,
};

/** The width the volume group unfolds its slider to, from volume.ts: what a folded slider is counted at. */
const SLIDER_WIDTH = 80;

/** Room kept between the last button and the edge, so nothing sits flush against it. */
const SLACK = 8;

interface Candidate {
  readonly node: Element;
  /** The bar child it sits in, for the order among equals. */
  readonly index: number;
  readonly priority: number;
}

function shown(node: Element): boolean {
  return node.getClientRects().length > 0;
}

/** The slider inside a volume group child, when it has one. */
function slider(child: Element): Element | null {
  return child.localName === VOLUME ? child.querySelector(VOLUME_SLIDER) : null;
}

/** A child's priority: its attribute, else its tag's default, else zero. */
function priority(child: Element): number {
  const own = child.getAttribute('priority');
  if (own !== null) {
    const value = Number(own);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  return PRIORITY[child.localName] ?? 0;
}

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
::slotted([collapsed]) { display: none; }
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
  declare private readonly buttonsRow: HTMLDivElement;
  declare private readonly buttons: HTMLSlotElement;
  declare private timer: ReturnType<typeof setTimeout> | undefined;
  /** Fires on a width change of the buttons row, so the collapse follows the page's layout. */
  declare private resizer: ResizeObserver | null;
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
    this.resizer = null;
    const root = this.attachShadow({ mode: 'open' });
    this.seekRow = document.createElement('div');
    this.seekRow.setAttribute('part', 'row seek-row');
    const seek = document.createElement('slot');
    seek.name = 'seek';
    this.seekRow.append(seek);
    this.buttonsRow = document.createElement('div');
    this.buttonsRow.setAttribute('part', 'row buttons-row');
    this.buttons = document.createElement('slot');
    this.buttonsRow.append(this.buttons);
    root.append(style(STYLE), this.seekRow, this.buttonsRow);
  }

  /**
   * What the buttons need: their widths and the gaps between them, the
   * spacer aside since it takes what is left, and a folded slider at the
   * width it unfolds to. The row's own width says nothing, because the
   * spacer fills it whatever the buttons take.
   */
  private needed(children: readonly Element[]): number {
    const gap = Number.parseFloat(getComputedStyle(this.buttonsRow).columnGap) || 0;
    let sum = 0;
    let count = 0;
    for (const child of children) {
      if (child.localName === SPACER || !shown(child)) continue;
      sum += child.getBoundingClientRect().width;
      count += 1;
      const folded = slider(child);
      if (folded !== null && shown(folded)) {
        sum += Math.max(0, SLIDER_WIDTH - folded.getBoundingClientRect().width);
      }
    }
    return sum + gap * Math.max(0, count - 1);
  }

  /**
   * Collapses the buttons row to its width. Everything is shown first, so
   * a wider bar gets its controls back, then the highest priorities go one
   * at a time while the buttons need more than the row has, less the
   * slack. Each step lays the row out again; a bar carries a dozen
   * controls, so that is cheap.
   */
  private collapse(): void {
    const children = this.buttons.assignedElements();
    const candidates: Candidate[] = [];
    for (const [index, child] of children.entries()) {
      child.removeAttribute('collapsed');
      const inner = slider(child);
      inner?.removeAttribute('collapsed');
      // A nested slider goes before its group, so it sorts as if it sat
      // after it. What is not shown, by its own `hidden` or a page's rule,
      // takes no room, so marking it would hide nothing and say something
      // false.
      if (inner !== null && shown(inner)) {
        candidates.push({ node: inner, index: index + 0.5, priority: priority(inner) });
      }
      if (shown(child)) candidates.push({ node: child, index, priority: priority(child) });
    }
    candidates.sort((a, b) => b.priority - a.priority || b.index - a.index);
    const room = this.buttonsRow.clientWidth - SLACK;
    for (const { node, priority: level } of candidates) {
      if (level === 0) return;
      if (this.needed(children) <= room) return;
      node.setAttribute('collapsed', '');
    }
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

    // The row's width, its children, and what they hide or reprioritise on
    // their own: each can change what fits. `collapsed` is left out of the
    // filter, since the bar writes it.
    const collapse = (): void => {
      this.collapse();
    };
    this.listen(this.buttons, ['slotchange'], collapse);
    this.observe(this, ['hidden', 'priority', 'slot'], collapse, true);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizer = new ResizeObserver(collapse);
      this.resizer.observe(this.buttonsRow);
    }
    collapse();
  }

  protected override detach(player: PlayerHost): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.resizer?.disconnect();
    this.resizer = null;
    for (const child of this.buttons.assignedElements()) {
      child.removeAttribute('collapsed');
      slider(child)?.removeAttribute('collapsed');
    }
    this.cues?.dispose();
    this.cues = null;
    this.screen = null;
    this.removeAttribute('idle');
    player.removeAttribute('idle');
    player.removeAttribute('fullscreen');
  }
}
