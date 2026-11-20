/**
 * @mattebox/player-360: 360° video in <mattebox-player>. <mbx-360> draws a
 * 360° source onto the inside of a sphere, and the viewer looks around.
 * Importing this module registers the element; that is the package's one
 * side effect.
 */
import { Mbx360 } from './element.js';

export type { Unavailable } from './element.js';
export { Mbx360 } from './element.js';
export type { Projection } from './view.js';

if (customElements.get('mbx-360') === undefined) {
  customElements.define('mbx-360', Mbx360);
}

declare global {
  interface HTMLElementTagNameMap {
    'mbx-360': Mbx360;
  }
}
