/** `@mattebox/player/elements/scan-button`: registers <mbx-scan-button>, and the player with it. */
import '../element-entry.js';
import { MbxScanButton } from '../elements/scan-button.js';
import { SCAN_BUTTON } from '../tags.js';

if (customElements.get(SCAN_BUTTON) === undefined)
  customElements.define(SCAN_BUTTON, MbxScanButton);

export { MbxScanButton };
