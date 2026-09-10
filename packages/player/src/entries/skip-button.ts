/** `@mattebox/player/elements/skip-button`: registers <mbx-skip-button>, and the player with it. */
import '../element-entry.js';
import { MbxSkipButton } from '../elements/skip-button.js';
import { SKIP_BUTTON } from '../tags.js';

if (customElements.get(SKIP_BUTTON) === undefined)
  customElements.define(SKIP_BUTTON, MbxSkipButton);

export { MbxSkipButton };
