/**
 * <mbx-spatial-nav>: the remote control for the player on a TV. Placed
 * inside the player, it renders nothing, and it moves focus between the
 * controls with the arrows of a five-way pad.
 *
 * It listens on the player in the capture phase, so it decides before the
 * focused control and the control bar, and takes a key by preventing it,
 * which they then leave alone. It is the one capture-phase listener in the
 * player.
 *
 * - An arrow moves focus to the nearest control on that side (`navigate.ts`).
 *   The opposite arrow returns to where the last move came from, so down
 *   then up lands where it started.
 * - On a slider, left and right stay the slider's: they seek or set the
 *   volume. Up and down move focus.
 * - Inside an element that carries `open`, a menu, every arrow and Enter
 *   stay the menu's.
 * - While the player carries `idle`, or after the pointer moved, the first
 *   arrow or Enter only places focus, on the control focused last, the one
 *   the pointer was over, or the one `initial` names, `mbx-play-button` by
 *   default. A stray arrow never seeks.
 * - An arrow with no control on its side fires `navigateout` on this
 *   element, bubbling and composed, with the direction as `detail`, so the
 *   application's own navigation takes focus out of the player. The arrow
 *   is taken all the same: left alone, the control bar would seek on it.
 * - Enter clicks a focused control that is not a native button, which
 *   clicks itself.
 * - Back is Escape for the focused control first: a menu goes back a page
 *   or closes, the seek bar drops its target. Nothing took it: focus leaves
 *   the controls, and the bar fades as it does after any pause. Focus
 *   already out: Back is the application's, to leave the player.
 *
 * TV sets report some remote keys by code alone (`keys.ts`). The element
 * sends each on again under the standard name the player reads, so the
 * control bar plays, pauses and seeks on the remote's media keys. The
 * application registers those keys with the platform itself, such as
 * `tizen.tvinputdevice.registerKey`: the player never does.
 */
import { Component } from './component.js';
import type { PlayerHost } from './host.js';
import { above } from './host.js';
import { isBack, keyOf } from './keys.js';
import type { Direction } from './navigate.js';
import { candidates, DIRECTIONS, nearest, OPPOSITE } from './navigate.js';

const INITIAL = 'mbx-play-button';

export class MbxSpatialNav extends Component {
  /** The control focused last inside the player. */
  declare private last: HTMLElement | null;
  /** The last move: from where, to where, which way. The opposite arrow goes back. */
  declare private move: { from: HTMLElement; to: HTMLElement; direction: Direction } | null;
  /** The control the pointer was over last. */
  declare private pointed: HTMLElement | null;
  /** The pointer moved: the next key places focus, from where the pointer was. */
  declare private resting: boolean;
  /** The key this element sends on, which its own listener lets pass. */
  declare private sending: Event | null;

  constructor() {
    super();
    this.last = null;
    this.move = null;
    this.pointed = null;
    this.resting = false;
    this.sending = null;
  }

  protected override attach(player: PlayerHost): void {
    this.on(player, 'keydown', (event) => this.key(player, event as KeyboardEvent), {
      capture: true,
    });
    this.on(player, 'pointermove', (event) => {
      this.resting = true;
      const list = candidates(player);
      const over = event.composedPath().find((node) => list.includes(node as HTMLElement));
      if (over !== undefined) this.pointed = over as HTMLElement;
    });
    this.on(player, 'focusin', () => {
      const current = this.focused(player);
      if (current !== null) this.last = current;
    });
  }

  /** The control focused inside the player, through shadow roots, or null. */
  private focused(player: PlayerHost): HTMLElement | null {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement != null) active = active.shadowRoot.activeElement;
    if (!(active instanceof HTMLElement) || active === player) return null;
    for (let node: Node | null = active; node !== null; node = above(node)) {
      if (node === player) return active;
    }
    return null;
  }

  /** Whether `element` sits inside something that carries `open`, below the player. */
  private inOpen(player: PlayerHost, element: HTMLElement): boolean {
    for (let node: Node | null = element; node !== null && node !== player; node = above(node)) {
      if (node instanceof HTMLElement && node.hasAttribute('open')) return true;
    }
    return false;
  }

  /** Where the first key puts focus: the pointer's control, the last one, or `initial`. */
  private start(player: PlayerHost): HTMLElement | null {
    const list = candidates(player);
    for (const known of [this.pointed, this.last]) {
      if (known !== null && list.includes(known)) return known;
    }
    const named = player.querySelector(this.getAttribute('initial') ?? INITIAL);
    return (
      list.find((element) => named?.contains(element) || named?.shadowRoot?.contains(element)) ??
      list[0] ??
      null
    );
  }

  private key(player: PlayerHost, event: KeyboardEvent): void {
    if (event === this.sending) return;
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const name = keyOf(event);
    const direction = DIRECTIONS[name];
    if (direction === undefined && name !== 'Enter') {
      if (isBack(name)) this.back(player, event);
      else if (name !== event.key) this.again(event, name);
      return;
    }
    const current = this.focused(player);
    // The first key while the bar sleeps, or after the pointer, only places
    // focus, so a stray arrow does not seek.
    if (current === null || this.resting || player.hasAttribute('idle')) {
      this.resting = false;
      const start = this.start(player);
      if (start === null) return;
      event.preventDefault();
      start.focus();
      return;
    }
    if (this.inOpen(player, current)) return;
    if (direction === undefined) {
      // Enter. A native button clicks itself on a real Enter; a code a TV
      // set sent without a name is not one, so the click comes from here.
      const native = current instanceof HTMLButtonElement && name === event.key;
      if (native || current.getAttribute('role') === 'slider') return;
      event.preventDefault();
      current.click();
      return;
    }
    const slider = current.getAttribute('role') === 'slider';
    if (slider && (direction === 'left' || direction === 'right')) {
      if (name !== event.key) this.again(event, name);
      return;
    }
    const list = candidates(player).filter((element) => element !== current);
    const back = this.move;
    const next =
      back !== null &&
      back.to === current &&
      back.direction === OPPOSITE[direction] &&
      list.includes(back.from)
        ? back.from
        : nearest(current.getBoundingClientRect(), list, direction);
    event.preventDefault();
    if (next === null) {
      this.dispatchEvent(
        new CustomEvent('navigateout', { detail: direction, bubbles: true, composed: true }),
      );
      return;
    }
    this.move = { from: current, to: next, direction };
    next.focus();
  }

  /**
   * Back: Escape for the focused control first. Nothing took it and focus
   * is on a control: focus leaves, and the bar fades. Otherwise it is the
   * application's.
   */
  private back(player: PlayerHost, event: KeyboardEvent): void {
    const current = this.focused(player);
    if (current === null) return;
    const cancel = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    event.stopPropagation();
    event.preventDefault();
    if (this.send(current, cancel)) current.blur();
  }

  /** Sends `event` on again under the standard `name`, in place of the original. */
  private again(event: KeyboardEvent, name: string): void {
    const target = event.composedPath()[0];
    if (target === undefined) return;
    event.stopPropagation();
    event.preventDefault();
    this.send(
      target,
      new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true }),
    );
  }

  /** Dispatches `event` on `target` past this element's own listener; false when a handler took it. */
  private send(target: EventTarget, event: Event): boolean {
    this.sending = event;
    try {
      return target.dispatchEvent(event);
    } finally {
      this.sending = null;
    }
  }
}
