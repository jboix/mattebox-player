/**
 * @mattebox/player-core: the headless layer of the Mattebox player. Source
 * resolution and the handler chain; nothing writes to the DOM here except
 * the native handler assigning `src`.
 */
export { Declined } from './errors.js';
export type { MatteboxHandlerOptions } from './handlers/mattebox.js';
export { matteboxHandler } from './handlers/mattebox.js';
export { nativeHandler } from './handlers/native.js';
export { inferType } from './infer-type.js';
export { createPlayer } from './player.js';
export type * from './types.js';
