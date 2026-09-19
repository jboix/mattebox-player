/** `@mattebox/player/elements/title`: registers <mbx-title>, and the player with it. */
import '../element-entry.js';
import { MbxTitle } from '../elements/title.js';
import { TITLE } from '../tags.js';

if (customElements.get(TITLE) === undefined) {
  customElements.define(TITLE, MbxTitle);
}

export { MbxTitle };
