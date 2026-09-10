/**
 * <mbx-duration>: the duration, "4:56", once the metadata is in. A live
 * stream has none, so the element hides while the stream is live.
 */
import { live, span } from '../controls/session.js';
import { format } from '../controls/time.js';
import { TimeElement } from './time-element.js';

export class MbxDuration extends TimeElement {
  constructor() {
    super(':host { text-align: right; }');
  }

  protected override render(): void {
    const player = this.player;
    if (player === null) return;
    const engine = player.engine;
    const on = live(engine) !== undefined;
    this.hidden = on;
    if (!on) this.text.data = format(span(player.video, engine).end);
  }
}
