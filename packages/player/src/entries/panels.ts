/** `@mattebox/player/elements/panels`: registers <mbx-panels>, and the player with it. */
import '../element-entry.js';
import { MbxPanels } from '../elements/panels.js';
import { PANELS } from '../tags.js';

if (customElements.get(PANELS) === undefined) customElements.define(PANELS, MbxPanels);

export { MbxPanels };
