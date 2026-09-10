/** `@mattebox/player/elements/control-bar`: registers <mbx-control-bar>, and the player with it. */
import '../element-entry.js';
import { MbxControlBar } from '../elements/control-bar.js';
import { CONTROL_BAR } from '../tags.js';

if (customElements.get(CONTROL_BAR) === undefined)
  customElements.define(CONTROL_BAR, MbxControlBar);

export { MbxControlBar };
