/** `@mattebox/player/elements/volume`: registers <mbx-volume>, and the player, the mute button and the slider with it. */
import '../element-entry.js';
import './mute-button.js';
import './volume-slider.js';
import { MbxVolume } from '../elements/volume.js';
import { VOLUME } from '../tags.js';

if (customElements.get(VOLUME) === undefined) customElements.define(VOLUME, MbxVolume);

export { MbxVolume };
