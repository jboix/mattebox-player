/** `@mattebox/player/elements/casting`: registers <mbx-casting>, and the player with it. */
import '../element-entry.js';
import { MbxCasting } from '../elements/casting.js';
import { CASTING } from '../tags.js';

if (customElements.get(CASTING) === undefined) {
  customElements.define(CASTING, MbxCasting);
}

export { MbxCasting };
