/** `@mattebox/player/elements/mute-button`: registers <mbx-mute-button>, and the player with it. */
import '../element-entry.js';
import { MbxMuteButton } from '../elements/mute-button.js';
import { MUTE_BUTTON } from '../tags.js';

if (customElements.get(MUTE_BUTTON) === undefined)
  customElements.define(MUTE_BUTTON, MbxMuteButton);

export { MbxMuteButton };
