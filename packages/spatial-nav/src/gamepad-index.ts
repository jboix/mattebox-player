/**
 * @mattebox/player-spatial-nav/gamepad: <mbx-gamepad> and
 * <mbx-gamepad-help>, a game controller for the player. Importing this
 * module registers both, and <mbx-spatial-nav>, which moves focus for the
 * controller. A page with a remote alone imports the package's main entry
 * and pays nothing for the controller.
 */
import { MbxGamepad } from './gamepad.js';
import { MbxGamepadHelp } from './gamepad-help.js';
import './index.js';

export type { GamepadActionDetail } from './gamepad.js';
export { MbxGamepad } from './gamepad.js';
export { MbxGamepadHelp } from './gamepad-help.js';
export * from './index.js';
export type { GamepadMessages } from './messages.js';
export type { PadAction, PadButton, PadKind, PadMap } from './pad.js';

export const GAMEPAD = 'mbx-gamepad';
export const GAMEPAD_HELP = 'mbx-gamepad-help';

if (customElements.get(GAMEPAD) === undefined) customElements.define(GAMEPAD, MbxGamepad);
if (customElements.get(GAMEPAD_HELP) === undefined) {
  customElements.define(GAMEPAD_HELP, MbxGamepadHelp);
}

declare global {
  interface HTMLElementTagNameMap {
    'mbx-gamepad': MbxGamepad;
    'mbx-gamepad-help': MbxGamepadHelp;
  }
}
