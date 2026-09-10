/** `@mattebox/player/elements/audio-menu`: registers <mbx-audio-menu>, and the player with it. */
import '../element-entry.js';
import { MbxAudioMenu } from '../elements/audio-menu.js';
import { AUDIO_MENU } from '../tags.js';

if (customElements.get(AUDIO_MENU) === undefined) customElements.define(AUDIO_MENU, MbxAudioMenu);

export { MbxAudioMenu };
