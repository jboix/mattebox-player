/** `@mattebox/player/elements/seek-bar`: registers <mbx-seek-bar>, and the player with it. */
import '../element-entry.js';
import { MbxSeekBar } from '../elements/seek-bar.js';
import { SEEK_BAR } from '../tags.js';

if (customElements.get(SEEK_BAR) === undefined) customElements.define(SEEK_BAR, MbxSeekBar);

export { MbxSeekBar };
