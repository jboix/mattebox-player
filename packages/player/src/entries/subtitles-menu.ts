/** `@mattebox/player/elements/subtitles-menu`: registers <mbx-subtitles-menu>, and the player with it. */
import '../element-entry.js';
import { MbxSubtitlesMenu } from '../elements/subtitles-menu.js';
import { SUBTITLES_MENU } from '../tags.js';

if (customElements.get(SUBTITLES_MENU) === undefined)
  customElements.define(SUBTITLES_MENU, MbxSubtitlesMenu);

export { MbxSubtitlesMenu };
