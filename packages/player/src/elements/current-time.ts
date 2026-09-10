/**
 * <mbx-current-time>: the position, "1:23". On a live stream it reads the
 * wall clock when `engine.pdt` can say it, "14:23:05", which is what a
 * viewer of a broadcast wants to know, and the distance behind the edge
 * otherwise, "-0:10". While the player says the stream is live but not
 * seekable, which the seek bar decides, there is no position to show and
 * the element hides.
 */
import { live, span, wall } from '../controls/session.js';
import { format } from '../controls/time.js';
import { TimeElement } from './time-element.js';

export class MbxCurrentTime extends TimeElement {
  protected override render(): void {
    const player = this.player;
    if (player === null) return;
    const video = player.video;
    const engine = player.engine;
    const on = live(engine) !== undefined;
    const time = video.currentTime;
    this.text.data = on
      ? (wall(engine, time) ?? `-${format(span(video, engine).end - time)}`)
      : format(time);
    this.hidden = on && player.hasAttribute('live') && !player.hasAttribute('seekable');
  }
}
