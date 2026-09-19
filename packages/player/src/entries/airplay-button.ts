/** `@mattebox/player/elements/airplay-button`: registers <mbx-airplay-button>, and the player with it. */
import '../element-entry.js';
import { MbxAirplayButton } from '../elements/airplay-button.js';
import { AIRPLAY_BUTTON } from '../tags.js';

if (customElements.get(AIRPLAY_BUTTON) === undefined) {
  customElements.define(AIRPLAY_BUTTON, MbxAirplayButton);
}

export { MbxAirplayButton };
