/** `@mattebox/player/elements/spinner`: registers <mbx-spinner>, and the player with it. */
import '../element-entry.js';
import { MbxSpinner } from '../elements/spinner.js';
import { SPINNER } from '../tags.js';

if (customElements.get(SPINNER) === undefined) {
  customElements.define(SPINNER, MbxSpinner);
}

export { MbxSpinner };
