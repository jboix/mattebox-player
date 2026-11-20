/**
 * @mattebox/player-360: 360° video in <mattebox-player>. <mbx-360> draws a
 * 360° source onto the inside of a sphere, and the viewer looks around.
 * <mbx-vr-button> shows the view in a WebXR headset. Importing this module
 * registers both elements; that is the package's one side effect.
 */
import { Mbx360 } from './element.js';
import { MbxVrButton } from './vr-button.js';

export type { Unavailable } from './element.js';
export { Mbx360 } from './element.js';
export type { Player360Messages } from './messages.js';
export type { Projection } from './view.js';
export { MbxVrButton } from './vr-button.js';

if (customElements.get('mbx-360') === undefined) {
  customElements.define('mbx-360', Mbx360);
}
if (customElements.get('mbx-vr-button') === undefined) {
  customElements.define('mbx-vr-button', MbxVrButton);
}

declare global {
  interface HTMLElementTagNameMap {
    'mbx-360': Mbx360;
    'mbx-vr-button': MbxVrButton;
  }
}
