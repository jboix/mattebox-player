/** `@mattebox/player/elements/current-time`: registers <mbx-current-time>, and the player with it. */
import '../element-entry.js';
import { MbxCurrentTime } from '../elements/current-time.js';
import { CURRENT_TIME } from '../tags.js';

if (customElements.get(CURRENT_TIME) === undefined)
  customElements.define(CURRENT_TIME, MbxCurrentTime);

export { MbxCurrentTime };
