/**
 * <mbx-live-button>: a dot and the word, the dot red at the edge and grey
 * behind it, the way viewers read it everywhere. Shown once the stream has
 * an availability window, which is what makes it live; disabled at the
 * edge, where there is nowhere to go; a click seeks to the edge, the one
 * engine write the row makes. The element carries `at-edge` meanwhile.
 *
 * Without a seek bar, when the player says the stream is not seekable,
 * there is nowhere to come back from either: the dot stays red and the
 * button stays inert, whatever the playhead does. The word comes from
 * `text`, the name from `label-live` and `label-at-edge`. It sits in the
 * bar's seek row unless the page says otherwise.
 */
import { live } from '../controls/session.js';
import { el } from '../dom.js';
import type { PlayerHost } from '../host.js';
import { Component } from './component.js';
import STYLE from './live-button.css?inline';
import { seekRow, style } from './shared.js';

export class MbxLiveButton extends Component {
  static get observedAttributes(): readonly string[] {
    return ['text', 'label-live', 'label-at-edge'];
  }

  declare private readonly button: HTMLButtonElement;
  declare private readonly text: HTMLElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    this.button = el('button', 'button');
    this.button.type = 'button';
    this.text = el('span', 'text');
    this.button.append(el('span', 'dot'), this.text);
    this.button.addEventListener('click', () => {
      live(this.player?.engine ?? null)?.seekToEdge();
    });
    root.append(style(STYLE), this.button);
  }

  override connectedCallback(): void {
    seekRow(this);
    super.connectedCallback();
  }

  protected override attach(player: PlayerHost): void {
    const tick = (): void => {
      this.render();
    };
    this.listen(player.video, ['timeupdate', 'emptied'], tick);
    this.listen(player, ['sourcechange'], tick);
    this.observe(player, ['live', 'seekable'], tick);
    this.render();
  }

  protected override render(): void {
    const player = this.player;
    if (player === null) return;
    const api = live(player.engine);
    this.hidden = api === undefined;
    this.text.textContent = this.getAttribute('text') ?? 'LIVE';
    if (api === undefined) return;
    // The seek bar decides seekability; while the player says live and not
    // seekable there is no bar to come back from.
    const stuck = player.hasAttribute('live') && !player.hasAttribute('seekable');
    const atEdge = stuck || api.atEdge;
    this.button.disabled = atEdge;
    this.toggleAttribute('at-edge', atEdge);
    this.button.setAttribute(
      'aria-label',
      atEdge
        ? (this.getAttribute('label-at-edge') ?? 'At the live edge')
        : (this.getAttribute('label-live') ?? 'Go to the live edge'),
    );
  }
}
