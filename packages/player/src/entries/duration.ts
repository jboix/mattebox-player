/** `@mattebox/player/elements/duration`: registers <mbx-duration>, and the player with it. */
import '../element-entry.js';
import { MbxDuration } from '../elements/duration.js';
import { DURATION } from '../tags.js';

if (customElements.get(DURATION) === undefined) customElements.define(DURATION, MbxDuration);

export { MbxDuration };
