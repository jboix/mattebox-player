/**
 * @mattebox/player-tv: <mbx-spatial-nav>, the remote control for the player
 * on a TV. Importing this module registers the element; that is the
 * package's one side effect. It is a package of its own because most pages
 * never run on a TV, and a page that does not pays nothing for it.
 */
import { MbxSpatialNav } from './spatial-nav.js';

export { MbxSpatialNav } from './spatial-nav.js';

export const SPATIAL_NAV = 'mbx-spatial-nav';

if (customElements.get(SPATIAL_NAV) === undefined) {
  customElements.define(SPATIAL_NAV, MbxSpatialNav);
}

declare global {
  interface HTMLElementTagNameMap {
    'mbx-spatial-nav': MbxSpatialNav;
  }
}
