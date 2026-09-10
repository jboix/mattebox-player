/** `@mattebox/player/elements/chapters-menu`: registers <mbx-chapters-menu>, and the player with it. */
import '../element-entry.js';
import { MbxChaptersMenu } from '../elements/chapters-menu.js';
import { CHAPTERS_MENU } from '../tags.js';

if (customElements.get(CHAPTERS_MENU) === undefined) {
  customElements.define(CHAPTERS_MENU, MbxChaptersMenu);
}

export { MbxChaptersMenu };
