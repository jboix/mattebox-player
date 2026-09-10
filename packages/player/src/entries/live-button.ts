/** `@mattebox/player/elements/live-button`: registers <mbx-live-button>, and the player with it. */
import '../element-entry.js';
import { MbxLiveButton } from '../elements/live-button.js';
import { LIVE_BUTTON } from '../tags.js';

if (customElements.get(LIVE_BUTTON) === undefined)
  customElements.define(LIVE_BUTTON, MbxLiveButton);

export { MbxLiveButton };
