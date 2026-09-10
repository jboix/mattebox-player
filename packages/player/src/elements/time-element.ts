/**
 * What the two time readouts share: the events they re-read the video on,
 * and the live and seekable states of the player, which the seek bar sets.
 * Each sits in the bar's seek row unless the page says otherwise.
 */
import type { PlayerHost } from '../host.js';
import { Component } from './component.js';
import { seekRow, style } from './shared.js';

const STYLE = `
:host { display: inline-block; min-width: 3ch; white-space: nowrap; font-variant-numeric: tabular-nums; }
:host([hidden]) { display: none; }
`;

const EVENTS = ['timeupdate', 'durationchange', 'loadedmetadata', 'seeking', 'seeked', 'emptied'];

export abstract class TimeElement extends Component {
  declare protected readonly text: Text;

  constructor(extra = '') {
    super();
    const root = this.attachShadow({ mode: 'open' });
    this.text = document.createTextNode('0:00');
    root.append(style(STYLE + extra), this.text);
  }

  override connectedCallback(): void {
    seekRow(this);
    super.connectedCallback();
  }

  protected override attach(player: PlayerHost): void {
    const tick = (): void => {
      this.render();
    };
    this.listen(player.video, EVENTS, tick);
    this.listen(player, ['sourcechange'], tick);
    this.observe(player, ['live', 'seekable'], tick);
    this.render();
  }
}
