/** `@mattebox/player/elements/video-menu`: registers <mbx-video-menu>, and the player with it. */
import '../element-entry.js';
import { MbxVideoMenu } from '../elements/video-menu.js';
import { VIDEO_MENU } from '../tags.js';

if (customElements.get(VIDEO_MENU) === undefined) customElements.define(VIDEO_MENU, MbxVideoMenu);

export { MbxVideoMenu };
