/** `@mattebox/player/elements/speed-menu`: registers <mbx-speed-menu>, and the player with it. */
import '../element-entry.js';
import { MbxSpeedMenu } from '../elements/speed-menu.js';
import { SPEED_MENU } from '../tags.js';

if (customElements.get(SPEED_MENU) === undefined) customElements.define(SPEED_MENU, MbxSpeedMenu);

export { MbxSpeedMenu };
