/** `@mattebox/player/elements/fullscreen-button`: registers <mbx-fullscreen-button>, and the player with it. */
import '../element-entry.js';
import { MbxFullscreenButton } from '../elements/fullscreen-button.js';
import { FULLSCREEN_BUTTON } from '../tags.js';

if (customElements.get(FULLSCREEN_BUTTON) === undefined)
  customElements.define(FULLSCREEN_BUTTON, MbxFullscreenButton);

export { MbxFullscreenButton };
