/** `@mattebox/player/elements/quality-menu`: registers <mbx-quality-menu>, and the player with it. */
import '../element-entry.js';
import { MbxQualityMenu } from '../elements/quality-menu.js';
import { QUALITY_MENU } from '../tags.js';

if (customElements.get(QUALITY_MENU) === undefined)
  customElements.define(QUALITY_MENU, MbxQualityMenu);

export { MbxQualityMenu };
