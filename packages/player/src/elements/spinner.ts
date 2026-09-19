/**
 * <mbx-spinner>: shows while the video waits for data, and nothing else. It
 * sits in the player beside the video, centred over the picture, so it is
 * over the poster and inside fullscreen. It reads the video's `waiting`,
 * `stalled`, `playing`, `canplay` and `emptied`, the same events the
 * player's `waiting` attribute comes from, and carries `waiting` on itself
 * so its stylesheet shows it. It takes the start button's place: a thin
 * ring turns there, a white head on a faint track, in the same monochrome
 * as the controls. The glyph is the `icon` slot, for a page's own; the
 * name comes from `label`.
 */
import type { PlayerHost } from '../host.js';
import { Component } from './component.js';
import { style } from './shared.js';

const STYLE = `
:host {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 44px;
  height: 44px;
  margin: -22px 0 0 -22px;
  display: none;
  pointer-events: none;
  color: var(--mbx-text);
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
}
:host([waiting]) { display: block; }
:host([hidden]) { display: none; }
[part~="ring"] {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  border: 3px solid rgba(255, 255, 255, 0.22);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: mbx-turn 0.8s linear infinite;
}
[part~="ring"][hidden] { display: none; }
slot[hidden] { display: none; }
::slotted(*) { width: 100%; height: 100%; }
@keyframes mbx-turn { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  [part~="ring"] { animation: none; }
}
`;

/** What the video fires as it waits and as it goes on. */
const EVENTS = ['waiting', 'stalled', 'playing', 'canplay', 'emptied'];

export class MbxSpinner extends Component {
  static get observedAttributes(): readonly string[] {
    return ['label'];
  }

  declare private readonly ring: HTMLElement;
  declare private readonly slot_: HTMLSlotElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    this.ring = document.createElement('div');
    this.ring.setAttribute('part', 'ring');
    this.slot_ = document.createElement('slot');
    this.slot_.name = 'icon';
    // A page's own glyph replaces the ring: the slot is watched for it.
    this.slot_.addEventListener('slotchange', () => {
      this.ring.hidden = this.slot_.assignedNodes().length > 0;
    });
    root.append(style(STYLE), this.ring, this.slot_);
  }

  /** Named before attaching: a constructor must not add attributes. */
  override connectedCallback(): void {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'status');
    super.connectedCallback();
  }

  protected override attach(player: PlayerHost): void {
    const video = player.video;
    this.listen(video, EVENTS, () => {
      this.render();
    });
    this.render();
  }

  protected override detach(): void {
    this.removeAttribute('waiting');
  }

  protected override render(): void {
    const player = this.player;
    if (player === null) return;
    this.setAttribute('aria-label', this.getAttribute('label') ?? 'Loading');
    // The player reflects the same events, and reads them first: it listens
    // from its constructor, before any control attaches.
    this.toggleAttribute('waiting', player.hasAttribute('waiting'));
  }
}
