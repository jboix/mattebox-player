/** `@mattebox/player/elements/volume-slider`: registers <mbx-volume-slider>, and the player with it. */
import '../element-entry.js';
import { MbxVolumeSlider } from '../elements/volume-slider.js';
import { VOLUME_SLIDER } from '../tags.js';

if (customElements.get(VOLUME_SLIDER) === undefined)
  customElements.define(VOLUME_SLIDER, MbxVolumeSlider);

export { MbxVolumeSlider };
