/**
 * @mattebox/player-360: 360° video in <mattebox-player>. <mbx-360> draws a
 * 360° source onto the inside of a sphere, and the viewer looks around,
 * with a drag, the W, A, S and D keys, a game controller or the device.
 * <mbx-vr-button> shows the view in a WebXR headset, or split in two for a
 * phone in a viewer, and <mbx-motion-button> lets the viewer turn the
 * device's motion on or off. Importing this module registers the three
 * elements; that is the package's one side effect.
 */
import { Mbx360 } from './element.js';
import { MbxMotionButton } from './motion-button.js';
import { MbxVrButton } from './vr-button.js';

export type { Headset, Unavailable } from './element.js';
export { Mbx360 } from './element.js';
export type { Player360Messages } from './messages.js';
export { MbxMotionButton } from './motion-button.js';
export type { FramePacking, Projection } from './view.js';
export { MbxVrButton } from './vr-button.js';

if (customElements.get('mbx-360') === undefined) {
  customElements.define('mbx-360', Mbx360);
}
if (customElements.get('mbx-motion-button') === undefined) {
  customElements.define('mbx-motion-button', MbxMotionButton);
}
if (customElements.get('mbx-vr-button') === undefined) {
  customElements.define('mbx-vr-button', MbxVrButton);
}

declare global {
  interface HTMLElementTagNameMap {
    'mbx-360': Mbx360;
    'mbx-motion-button': MbxMotionButton;
    'mbx-vr-button': MbxVrButton;
  }
}
