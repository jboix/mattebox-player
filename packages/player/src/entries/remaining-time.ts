/** `@mattebox/player/elements/remaining-time`: registers <mbx-remaining-time>, and the player with it. */
import '../element-entry.js';
import { MbxRemainingTime } from '../elements/remaining-time.js';
import { REMAINING_TIME } from '../tags.js';

if (customElements.get(REMAINING_TIME) === undefined) {
  customElements.define(REMAINING_TIME, MbxRemainingTime);
}

export { MbxRemainingTime };
