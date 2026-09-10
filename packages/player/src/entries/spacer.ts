/** `@mattebox/player/elements/spacer`: registers <mbx-spacer>, and the player with it. */
import '../element-entry.js';
import { MbxSpacer } from '../elements/spacer.js';
import { SPACER } from '../tags.js';

if (customElements.get(SPACER) === undefined) customElements.define(SPACER, MbxSpacer);

export { MbxSpacer };
