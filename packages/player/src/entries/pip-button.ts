/** `@mattebox/player/elements/pip-button`: registers <mbx-pip-button>, and the player with it. */
import '../element-entry.js';
import { MbxPipButton } from '../elements/pip-button.js';
import { PIP_BUTTON } from '../tags.js';

if (customElements.get(PIP_BUTTON) === undefined) customElements.define(PIP_BUTTON, MbxPipButton);

export { MbxPipButton };
