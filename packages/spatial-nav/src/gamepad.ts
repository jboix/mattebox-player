/**
 * <mbx-gamepad>: a game controller drives the player. Placed inside the
 * player beside <mbx-spatial-nav>, it renders nothing.
 *
 * The Gamepad API has no button events, so the element reads the pads once
 * a frame, on `requestAnimationFrame`. It reads them only while one is
 * connected and the page is visible: a page without a pad pays nothing
 * after `attach`.
 *
 * Each press of a button takes the action the mapping gives it (`pad.ts`).
 * The element fires `gamepadaction` first, cancellable, so the page can
 * take any action, or one of its own name. Nobody took it: the element
 * sends the player the key a remote would send.
 *
 * - The directions are the arrows, which <mbx-spatial-nav> turns into
 *   moves of focus. They repeat while held.
 * - `activate` is Enter on the focused control. With no control focused,
 *   or the bar asleep, it plays or pauses.
 * - `back` is the remote's Back. With no control focused, it leaves
 *   fullscreen first; after that, Back is the application's.
 * - `rewind` and `fast-forward` seek a step at each press, and again while
 *   held, faster the harder the trigger is pressed.
 * - `previous` and `next` go to the chapter before or after, when the
 *   programme has chapters, else to the playlist's item.
 *
 * A press sets `focus-ring` on the player, and a pointer's press takes it
 * off. The keys the element sends are synthetic, and after them the
 * browser shows no `:focus-visible`, so without it the focus would not show.
 *
 * Edge on Xbox drives a mouse cursor with the pad unless the page asks for
 * the pad itself, so the element asks, where the browser has the switch.
 */
import { Component } from './component.js';
import type { PlayerHost } from './host.js';
import { focusedIn } from './host.js';
import type { PadButton, PadKind, PadMap } from './pad.js';
import { BUTTONS, kindOf, mapping, parseMap } from './pad.js';

/** The help bubble's tag: `help` opens it. */
const HELP = 'mbx-gamepad-help';

/** The player's attribute that shows the focus a pad gave. */
const RING = 'focus-ring';

/** The left stick leans a direction past this much. */
const DEAD_ZONE = 0.5;

/** A trigger counts as pressed past this much of its travel. */
const TRIGGER = 0.15;

/** A held direction repeats after this long, in ms, then every `STEP_MS`. */
const DELAY_MS = 400;
const STEP_MS = 120;

/** A held trigger seeks again after this long, in ms, then every `SCAN_MS` at full press. */
const SCAN_DELAY_MS = 300;
const SCAN_MS = 100;

/** Back to the start of the chapter, not the one before, this far into it, in seconds. */
const RESTART_S = 3;

/** The seconds a step seeks where no control bar answers the media keys. */
const STEP_S = 5;

/** The keys the directions send. */
const ARROWS: Readonly<Record<string, string>> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

/** The actions that repeat while their button is held. */
const REPEATING = new Set(['up', 'down', 'left', 'right', 'rewind', 'fast-forward']);

/** What `gamepadaction` carries. */
export interface GamepadActionDetail {
  readonly action: string;
  readonly button: PadButton;
  readonly kind: PadKind;
}

/** A held button: when it acts again. */
interface Held {
  next: number;
}

export class MbxGamepad extends Component {
  /** The buttons down on each pad, by the pad's index. */
  declare private held: Map<number, Map<PadButton, Held>>;
  /** The animation frame asked for, or 0 while the loop sleeps. */
  declare private frame: number;
  /** The mapping the page set from script, over the attribute's. */
  declare private own: PadMap;
  /** The make of the pad used last. */
  declare private last: PadKind;

  constructor() {
    super();
    this.held = new Map();
    this.frame = 0;
    this.own = {};
    this.last = 'xbox';
  }

  /** The overrides set from script, over the defaults and the `map` attribute. Null unbinds a button. */
  get map(): PadMap {
    return Object.assign({}, this.own);
  }

  set map(value: PadMap) {
    // Object.assign, not a spread: the ES2015 build would lower a spread into a helper.
    this.own = Object.assign({}, value);
  }

  /** The make of the pad used last, `xbox` before any. */
  get kind(): PadKind {
    return this.last;
  }

  /** What each button does on `kind`: the defaults, the `map` attribute, then `map`. */
  bindings(kind: PadKind = this.last): Record<PadButton, string | null> {
    return mapping(kind, parseMap(this.getAttribute('map')), this.own);
  }

  override disconnectedCallback(): void {
    this.stop();
    this.player?.removeAttribute(RING);
    super.disconnectedCallback();
  }

  protected override attach(player: PlayerHost): void {
    const nav = navigator as Navigator & { gamepadInputEmulation?: string };
    if ('gamepadInputEmulation' in nav) nav.gamepadInputEmulation = 'gamepad';
    this.on(window, 'gamepadconnected', (event) => {
      const pad = (event as GamepadEvent).gamepad;
      this.last = kindOf(pad.id);
      this.tell('gamepadconnect', pad);
      this.start(player);
    });
    this.on(window, 'gamepaddisconnected', (event) => {
      const pad = (event as GamepadEvent).gamepad;
      this.held.delete(pad.index);
      this.tell('gamepaddisconnect', pad);
    });
    this.on(document, 'visibilitychange', () => this.start(player));
    this.on(player, 'pointerdown', () => player.removeAttribute(RING), { capture: true });
    this.start(player);
  }

  /** Fires `name` on the element, bubbling and composed, with the pad's make and id. */
  private tell(name: string, pad: Gamepad): void {
    const detail = { kind: kindOf(pad.id), id: pad.id };
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  /** The connected pads. Chromium lists empty slots as null. */
  private pads(): Gamepad[] {
    if (typeof navigator.getGamepads !== 'function') return [];
    const out: Gamepad[] = [];
    for (const pad of navigator.getGamepads()) if (pad?.connected === true) out.push(pad);
    return out;
  }

  /** Starts the loop, unless it runs, the page is hidden, or no pad is connected. */
  private start(player: PlayerHost): void {
    if (this.frame !== 0 || document.hidden || this.pads().length === 0) return;
    this.frame = requestAnimationFrame((now) => this.tick(player, now));
  }

  private stop(): void {
    if (this.frame !== 0) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.held.clear();
  }

  private tick(player: PlayerHost, now: number): void {
    this.frame = 0;
    const pads = this.pads();
    if (pads.length === 0 || document.hidden || this.player !== player) {
      this.held.clear();
      return;
    }
    for (const pad of pads) this.read(player, pad, now);
    this.frame = requestAnimationFrame((next) => this.tick(player, next));
  }

  /** Compares one pad with the frame before, and acts on what went down or is held. */
  private read(player: PlayerHost, pad: Gamepad, now: number): void {
    const kind = kindOf(pad.id);
    let held = this.held.get(pad.index);
    if (held === undefined) {
      held = new Map();
      this.held.set(pad.index, held);
    }
    const map = this.bindings(kind);
    for (const [index, button] of BUTTONS.entries()) {
      const value = this.value(pad, index, button);
      const was = held.get(button);
      if (value === 0) {
        held.delete(button);
        continue;
      }
      const action = map[button];
      if (was === undefined) {
        this.last = kind;
        held.set(button, {
          next: now + (action === 'rewind' || action === 'fast-forward' ? SCAN_DELAY_MS : DELAY_MS),
        });
        if (action != null) this.act(player, action, button, kind);
      } else if (action != null && REPEATING.has(action) && now >= was.next) {
        const scan = action === 'rewind' || action === 'fast-forward';
        was.next = now + (scan ? SCAN_MS + (1 - value) * SCAN_DELAY_MS : STEP_MS);
        this.act(player, action, button, kind);
      }
    }
  }

  /**
   * How far `button` is pressed, from 0 to 1, or 0 when it is not. The
   * directions read the left stick too, past the dead zone.
   */
  private value(pad: Gamepad, index: number, button: PadButton): number {
    const own = pad.buttons[index];
    const trigger = button === 'lt' || button === 'rt';
    let value = own === undefined ? 0 : own.pressed ? Math.max(own.value, 0.5) : own.value;
    if (value < (trigger ? TRIGGER : 0.5)) value = 0;
    const x = pad.axes[0] ?? 0;
    const y = pad.axes[1] ?? 0;
    const lean =
      button === 'left'
        ? -x
        : button === 'right'
          ? x
          : button === 'up'
            ? -y
            : button === 'down'
              ? y
              : 0;
    return lean > DEAD_ZONE ? Math.max(value, 1) : value;
  }

  /** Asks the page with `gamepadaction`, then does the action nobody took. */
  private act(player: PlayerHost, action: string, button: PadButton, kind: PadKind): void {
    const detail: GamepadActionDetail = { action, button, kind };
    const asked = new CustomEvent('gamepadaction', {
      detail,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    if (!this.dispatchEvent(asked)) return;
    player.toggleAttribute(RING, true);
    this.run(player, action);
  }

  private run(player: PlayerHost, action: string): void {
    const media = player.media;
    const arrow = ARROWS[action];
    if (arrow !== undefined) {
      this.key(focusedIn(player) ?? player, arrow);
      return;
    }
    switch (action) {
      case 'activate':
        this.activate(player);
        break;
      case 'back':
        this.back(player);
        break;
      case 'play-pause':
        if (this.key(player, 'MediaPlayPause')) toggle(media);
        break;
      case 'rewind':
        if (this.key(player, 'MediaRewind'))
          media.currentTime = Math.max(0, media.currentTime - STEP_S);
        break;
      case 'fast-forward':
        if (this.key(player, 'MediaFastForward')) media.currentTime += STEP_S;
        break;
      case 'previous':
        this.skip(player, -1);
        break;
      case 'next':
        this.skip(player, 1);
        break;
      case 'subtitles':
        this.press(player, 'mbx-subtitles-menu');
        break;
      case 'mute':
        if (this.key(player, 'm')) media.muted = !media.muted;
        break;
      case 'fullscreen':
        this.key(player, 'f');
        break;
      case 'help':
        player.querySelector(HELP)?.toggleAttribute('open');
        break;
      default:
        // A name of the page's own: `gamepadaction` was all of it.
        break;
    }
  }

  /**
   * Enter on the focused control. A native button clicks itself only on a
   * real Enter, so a button nobody took is clicked here. No control
   * focused, or the bar asleep: play or pause, as on a console's player.
   */
  private activate(player: PlayerHost): void {
    const current = focusedIn(player);
    if (current === null || player.hasAttribute('idle')) {
      if (this.key(player, 'MediaPlayPause')) toggle(player.media);
      return;
    }
    if (this.key(current, 'Enter') && current instanceof HTMLButtonElement) current.click();
  }

  /** The remote's Back, which <mbx-spatial-nav> reads. With nothing focused, fullscreen ends first. */
  private back(player: PlayerHost): void {
    const current = focusedIn(player);
    if (current === null && player.hasAttribute('fullscreen')) {
      this.key(player, 'f');
      return;
    }
    this.key(current ?? player, 'GoBack');
  }

  /**
   * The chapter before or after, else the playlist's item. Previous goes
   * to the start of the chapter that plays first, past its first seconds,
   * as a remote's previous does.
   */
  private skip(player: PlayerHost, by: 1 | -1): void {
    const media = player.media;
    // A player before 0.16 has no `chapters`: the playlist's item, then.
    const list = player.chapters ?? [];
    const now = media.currentTime;
    let at = -1;
    for (const [i, chapter] of list.entries()) if (chapter.start <= now) at = i;
    const target =
      by === 1
        ? list[at + 1]
        : at >= 0 && now - (list[at]?.start ?? 0) > RESTART_S
          ? list[at]
          : list[at - 1];
    if (target !== undefined) {
      media.currentTime = target.start;
      return;
    }
    this.press(player, by === 1 ? 'mbx-next-button' : 'mbx-previous-button');
  }

  /** Clicks the button of the control `tag` in the player, when it shows. */
  private press(player: PlayerHost, tag: string): void {
    const button = player.querySelector(tag)?.shadowRoot?.querySelector('button');
    if (button == null || button.getClientRects().length === 0) return;
    button.click();
  }

  /** Sends `name` as a keydown on `target`; true when nobody took it. */
  private key(target: EventTarget, name: string): boolean {
    return target.dispatchEvent(
      new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true }),
    );
  }
}

/** Plays a paused video, pauses a playing one. */
function toggle(media: HTMLVideoElement): void {
  if (media.paused) void media.play().catch(() => undefined);
  else media.pause();
}
