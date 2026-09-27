/**
 * <mbx-scan-button>: fast forward, or rewind with `direction="backward"`,
 * through the I-frame track: `engine.trick.setRate`, see the engine guide's
 * trick play chapter. Each press steps up through `rates`, "4 8 16" by
 * default, and a press past the last one plays at normal speed again. A
 * press while the other button scans starts this one at its first rate.
 * Every rate must be above 2, the engine's own floor for a scan.
 *
 * The button shows only when the session has an I-frame track: without
 * one there is no picture to scan with, and the speed menu covers playback
 * speed. It hides too on a live stream whose window is too short to seek,
 * where the player carries `live` and not `seekable`, as the seek bar does. It carries `aria-pressed` and `scanning` while it scans, and its
 * `rate` part shows the rate, "8×". The name comes from `label`,
 * "Fast forward" or "Rewind".
 */
import { icon } from '../controls/icons.js';
import { optional } from '../controls/session.js';
import { el } from '../dom.js';
import type { PlayerHost } from '../host.js';
import { Component } from './component.js';
import STYLE_CSS from './scan-button.css?inline';
import { BUTTON_STYLE, style } from './shared.js';

const RATES = [4, 8, 16];

/** The engine's floor: a scan rate is above 2 or below -2. */
const FLOOR = 2;

/**
 * What changes the rate or whether scanning is possible: every rate change,
 * from either button, the page, or the engine ending a scan, and a new track
 * list, which is when an I-frame track appears.
 */
const ENGINE_EVENTS = ['trick:rate', 'tracks:changed'];

const STYLE = BUTTON_STYLE + STYLE_CSS;

export class MbxScanButton extends Component {
  static get observedAttributes(): readonly string[] {
    return ['direction', 'rates', 'label'];
  }

  declare private readonly button: HTMLButtonElement;
  declare private readonly glyph: HTMLSlotElement;
  declare private readonly badge: HTMLElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    this.button = el('button', 'button');
    this.button.type = 'button';
    this.glyph = document.createElement('slot');
    this.glyph.name = 'icon';
    this.badge = el('span', 'rate');
    this.badge.hidden = true;
    this.button.append(this.glyph, this.badge);
    this.button.addEventListener('click', () => {
      this.step();
    });
    root.append(style(STYLE), this.button);
  }

  override connectedCallback(): void {
    // Hidden until a session says it has an I-frame track. Not in the
    // constructor: a new custom element must not have attributes.
    this.hidden = true;
    super.connectedCallback();
  }

  private backward(): boolean {
    return this.getAttribute('direction') === 'backward';
  }

  /** The rates to step through, each above the floor, in the order given. */
  private rates(): number[] {
    const own = (this.getAttribute('rates') ?? '')
      .split(/\s+/)
      .map(Number)
      .filter((rate) => Number.isFinite(rate) && rate > FLOOR);
    return own.length > 0 ? own : RATES;
  }

  private step(): void {
    const trick = optional(this.player?.engine ?? null).trick;
    if (trick?.available !== true) return;
    const sign = this.backward() ? -1 : 1;
    const rates = this.rates();
    const now = trick.rate * sign;
    // Scanning this way: the next rate up, or normal playback past the last.
    const next = now > FLOOR ? rates[rates.indexOf(now) + 1] : rates[0];
    trick.setRate(next === undefined ? 1 : next * sign);
    this.render();
  }

  protected override attach(player: PlayerHost): void {
    const tick = (): void => {
      this.render();
    };
    this.listen(player.video, ['emptied'], tick);
    this.observe(player, ['live', 'seekable'], tick);
    this.follow(player, (engine) => {
      tick();
      if (engine === null) return undefined;
      const offs = ENGINE_EVENTS.map((name) => engine.on(name, tick));
      return () => {
        for (const off of offs) off();
      };
    });
  }

  protected override render(): void {
    const trick = optional(this.player?.engine ?? null).trick;
    const backward = this.backward();
    const player = this.player;
    const unseekable = player?.hasAttribute('live') === true && !player.hasAttribute('seekable');
    this.hidden = trick?.available !== true || unseekable;
    const rate = trick?.rate ?? 1;
    const on = backward ? rate < -FLOOR : rate > FLOOR;
    this.toggleAttribute('scanning', on);
    this.button.setAttribute('aria-pressed', String(on));
    this.badge.hidden = !on;
    this.badge.textContent = on ? `${Math.abs(rate)}×` : '';
    this.glyph.replaceChildren(icon(backward ? 'fast-backward' : 'fast-forward'));
    const name = this.getAttribute('label') ?? (backward ? 'Rewind' : 'Fast forward');
    this.button.setAttribute('aria-label', name);
  }
}
