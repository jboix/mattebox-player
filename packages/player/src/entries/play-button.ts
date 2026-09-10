/** `@mattebox/player/elements/play-button`: registers <mbx-play-button>, and the player with it. */
import '../element-entry.js';
import { MbxPlayButton } from '../elements/play-button.js';
import { PLAY_BUTTON } from '../tags.js';

if (customElements.get(PLAY_BUTTON) === undefined)
  customElements.define(PLAY_BUTTON, MbxPlayButton);

export { MbxPlayButton };
