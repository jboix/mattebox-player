/** `@mattebox/player/elements/marker-button`: registers <mbx-marker-button>, and the player with it. */
import '../element-entry.js';
import { MbxMarkerButton } from '../elements/marker-button.js';
import { MARKER_BUTTON } from '../tags.js';

if (customElements.get(MARKER_BUTTON) === undefined)
  customElements.define(MARKER_BUTTON, MbxMarkerButton);

export { MbxMarkerButton };
