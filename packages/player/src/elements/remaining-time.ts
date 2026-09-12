/**
 * <mbx-remaining-time>: what is left, "-4:53", once the metadata is in. A
 * bar that shows one number shows this one: a viewer asks how much is
 * left more often than where they are. A live stream has no end, so the
 * element hides while the stream is live, as the duration does.
 */
import { live, span } from '../controls/session.js';
import { format } from '../controls/time.js';
import { TimeElement } from './time-element.js';

export class MbxRemainingTime extends TimeElement {
  constructor() {
    super(':host { text-align: right; }');
  }

  protected override render(): void {
    const player = this.player;
    if (player === null) return;
    const video = player.video;
    const engine = player.engine;
    const on = live(engine) !== undefined;
    this.hidden = on;
    if (!on)
      this.text.data = `-${format(Math.max(0, span(video, engine).end - video.currentTime))}`;
  }
}
