/**
 * @mattebox/player-cast: <mbx-cast-button> and <mbx-cast-screen>, Chromecast
 * from the player over Google's sender SDK. Importing this module registers
 * both elements; that is the package's one side effect. It is a package of
 * its own because the button loads Google's script onto the page, which the
 * player never does on an integrator's behalf: the AirPlay button, over
 * Safari's own API, ships with the player.
 */
import { MbxCastButton } from './cast-button.js';
import { MbxCastScreen } from './cast-screen.js';

export type { CastState, LoadRequest as CastLoadRequest, MediaInfo, Track } from './cast.js';
export { MbxCastButton } from './cast-button.js';
export { MbxCastScreen } from './cast-screen.js';

export const CAST_BUTTON = 'mbx-cast-button';
export const CAST_SCREEN = 'mbx-cast-screen';

if (customElements.get(CAST_BUTTON) === undefined) {
  customElements.define(CAST_BUTTON, MbxCastButton);
}
if (customElements.get(CAST_SCREEN) === undefined) {
  customElements.define(CAST_SCREEN, MbxCastScreen);
}

declare global {
  interface HTMLElementTagNameMap {
    'mbx-cast-button': MbxCastButton;
    'mbx-cast-screen': MbxCastScreen;
  }
}
