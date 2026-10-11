/**
 * <mbx-duration>: the duration, "4:56", once the metadata is in. A live
 * stream has none, so the element hides while the stream is live. On a
 * compact player it shows the time left, "-3:12", in place of the current
 * time, which hides there.
 */
import { live, span } from '../controls/session.js';
import { format } from '../controls/time.js';
import { TimeElement } from './time-element.js';
import TRAILING from './trailing-time.css?inline';

export class MbxDuration extends TimeElement {
  constructor() {
    super(TRAILING);
  }

  protected override render(): void {
    const player = this.player;
    if (player === null) return;
    const engine = player.engine;
    const on = live(engine) !== undefined;
    this.hidden = on;
    if (on) return;
    const end = span(player.video, engine).end;
    // A compact player has one readout, so this one counts down.
    this.text.data =
      this.getAttribute('layout') === 'compact'
        ? `-${format(Math.max(0, end - player.video.currentTime))}`
        : format(end);
  }
}
