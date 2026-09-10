/** `@mattebox/player/elements/start-button`: registers <mbx-start-button>, and the player with it. */
import '../element-entry.js';
import { MbxStartButton } from '../elements/start-button.js';
import { START_BUTTON } from '../tags.js';

if (customElements.get(START_BUTTON) === undefined)
  customElements.define(START_BUTTON, MbxStartButton);

export { MbxStartButton };
