/**
 * <mbx-gamepad-help>: a bubble over the video that lists what each button
 * of the controller does. It reads the mapping from the player's
 * <mbx-gamepad>, overrides included, and draws the buttons as the make of
 * the pad in use prints them.
 *
 * - It opens when a pad connects, and closes by itself after `close-ms`
 *   (6000 by default). `manual` keeps it closed until the `help` action.
 * - The `help` action opens and closes it. Back closes it.
 * - `label` names the bubble ("Controller"). `label-<action>` names an
 *   action, such as `label-next="Next episode"`; an action of the page's
 *   own shows only with a label.
 * - Without a label, the words come from the player's language, else English.
 */
import type { Messages } from '@mattebox/player';
import { Component } from './component.js';
import type { GamepadActionDetail, MbxGamepad } from './gamepad.js';
import STYLE from './gamepad-help.css?inline';
import type { PlayerHost } from './host.js';
import type {} from './messages.js';
import type { PadButton, PadKind } from './pad.js';
import { BUTTONS, GLYPHS, SPOKEN } from './pad.js';

const CLOSE_MS = 6000;

/** Each action with the id and the English of its words, in the order the bubble lists them. */
const WORDS: ReadonlyArray<readonly [string, keyof Messages, string]> = [
  ['move', 'gamepadMove', 'Move'],
  ['activate', 'gamepadSelect', 'Select'],
  ['back', 'gamepadBack', 'Back'],
  ['play-pause', 'gamepadPlayPause', 'Play or pause'],
  ['rewind', 'gamepadRewind', 'Rewind'],
  ['fast-forward', 'gamepadFastForward', 'Fast forward'],
  ['previous', 'gamepadPrevious', 'Previous'],
  ['next', 'gamepadNext', 'Next'],
  ['subtitles', 'gamepadSubtitles', 'Subtitles'],
  ['mute', 'gamepadMute', 'Mute'],
  ['fullscreen', 'gamepadFullscreen', 'Fullscreen'],
  ['help', 'gamepadControls', 'Controls'],
];

const DIRECTIONS = new Set(['up', 'down', 'left', 'right']);

export class MbxGamepadHelp extends Component {
  declare private list: HTMLDListElement;
  declare private heading: HTMLElement;
  declare private timer: ReturnType<typeof setTimeout> | undefined;

  static get observedAttributes(): string[] {
    return ['open'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLE;
    const bubble = document.createElement('section');
    bubble.setAttribute('part', 'bubble');
    this.heading = document.createElement('h2');
    this.heading.setAttribute('part', 'heading');
    this.heading.id = 'heading';
    bubble.setAttribute('aria-labelledby', 'heading');
    this.list = document.createElement('dl');
    this.list.setAttribute('part', 'list');
    bubble.append(this.heading, this.list);
    root.append(style, bubble);
    this.timer = undefined;
  }

  attributeChangedCallback(): void {
    clearTimeout(this.timer);
    if (this.hasAttribute('open')) this.render();
  }

  override disconnectedCallback(): void {
    clearTimeout(this.timer);
    super.disconnectedCallback();
  }

  protected override attach(player: PlayerHost): void {
    this.on(player, 'gamepadconnect', () => {
      if (this.hasAttribute('manual')) return;
      this.setAttribute('open', '');
      this.timer = setTimeout(() => this.removeAttribute('open'), number(this, 'close-ms'));
    });
    this.on(player, 'gamepadaction', (event) => {
      const { action } = (event as CustomEvent<GamepadActionDetail>).detail;
      if (action === 'back' && this.hasAttribute('open')) {
        event.preventDefault();
        this.removeAttribute('open');
      }
    });
    this.on(player, 'localechange', () => {
      if (this.hasAttribute('open')) this.render();
    });
    if (this.hasAttribute('open')) this.render();
  }

  /**
   * A word the bubble shows: its `attribute` when the page set one, else
   * the player's language's `id`, else `english`.
   */
  private word(attribute: string, id: keyof Messages, english: string): string {
    return this.getAttribute(attribute) ?? this.player?.message(id) ?? english;
  }

  /** The player's <mbx-gamepad>, or null. */
  private pad(): MbxGamepad | null {
    return this.player?.querySelector('mbx-gamepad') ?? null;
  }

  /** Lists each action the mapping binds, with its buttons as the make in use prints them. */
  private render(): void {
    const pad = this.pad();
    const kind: PadKind = pad?.kind ?? 'xbox';
    this.heading.textContent = this.word('label', 'gamepadController', 'Controller');
    this.setAttribute('kind', kind);
    const bindings = pad?.bindings(kind) ?? null;
    const by = new Map<string, PadButton[]>();
    if (bindings !== null) {
      for (const button of BUTTONS) {
        const action = bindings[button];
        if (action == null) continue;
        const key = DIRECTIONS.has(action) && action === button ? 'move' : action;
        by.set(key, [...(by.get(key) ?? []), button]);
      }
    }
    const rows: Node[] = [];
    const known = new Set(WORDS.map(([action]) => action));
    const order = [
      ...WORDS.map(([action]) => action),
      ...[...by.keys()].filter((a) => !known.has(a)),
    ];
    for (const action of order) {
      const buttons = by.get(action);
      if (buttons === undefined) continue;
      const own = WORDS.find(([name]) => name === action);
      const words =
        own === undefined
          ? this.getAttribute(`label-${action}`)
          : this.word(`label-${action}`, own[1], own[2]);
      if (words === null) continue;
      const term = document.createElement('dt');
      for (const button of buttons) term.append(this.glyph(GLYPHS[kind][button]));
      const description = document.createElement('dd');
      description.textContent = words;
      rows.push(term, description);
    }
    // Not replaceChildren(): Chromium 76 has none.
    while (this.list.firstChild !== null) this.list.removeChild(this.list.firstChild);
    for (const row of rows) this.list.append(row);
  }

  /** A button as its make prints it, named for a screen reader where the print is a symbol. */
  private glyph(text: string): HTMLElement {
    const kbd = document.createElement('kbd');
    kbd.setAttribute('part', 'button');
    kbd.textContent = text;
    const spoken = SPOKEN[text];
    if (spoken !== undefined) {
      kbd.setAttribute('aria-label', this.player?.message(spoken[0]) ?? spoken[1]);
    }
    return kbd;
  }
}

/** The element's number attribute `name`, or the default. */
function number(element: Element, name: string): number {
  const value = Number(element.getAttribute(name));
  return element.hasAttribute(name) && Number.isFinite(value) ? value : CLOSE_MS;
}
