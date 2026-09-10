/** `@mattebox/player/elements/error-screen`: registers <mbx-error-screen>, and the player with it. */
import '../element-entry.js';
import { MbxErrorScreen } from '../elements/error-screen.js';
import { ERROR_SCREEN } from '../tags.js';

if (customElements.get(ERROR_SCREEN) === undefined)
  customElements.define(ERROR_SCREEN, MbxErrorScreen);

export { MbxErrorScreen };
