/**
 * @mattebox/player-cast: <mbx-cast-button>, Chromecast from the player
 * over Google's sender SDK. Importing this module registers the element;
 * that is the package's one side effect. While a device plays, the
 * player's own controls drive it, and <mbx-casting> of the player names it. It is a package of
 * its own because the button loads Google's script onto the page, which the
 * player never does on an integrator's behalf: the AirPlay button, over
 * Safari's own API, ships with the player.
 */
import { MbxCastButton } from './cast-button.js';

export type {
  CastMetadata,
  CastState,
  LicenseReply,
  LoadRequest as CastLoadRequest,
  MatteboxCustomData,
  MediaInfo,
  Track,
  UnauthorizedDetail,
} from './cast.js';
export { LICENSE_NAMESPACE } from './cast.js';
export { MbxCastButton } from './cast-button.js';
export type { CastMessages } from './messages.js';

export const CAST_BUTTON = 'mbx-cast-button';

if (customElements.get(CAST_BUTTON) === undefined) {
  customElements.define(CAST_BUTTON, MbxCastButton);
}

declare global {
  interface HTMLElementTagNameMap {
    'mbx-cast-button': MbxCastButton;
  }
}
