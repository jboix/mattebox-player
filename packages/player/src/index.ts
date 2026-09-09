/**
 * @mattebox/player: the <mattebox-player> custom element. Importing this
 * module registers the element; that is the package's one side effect.
 */
import { MatteboxPlayerElement } from './element.js';

export type { ControlsOptions } from './controls/options.js';
export { LAYOUT } from './controls/options.js';
export { MatteboxPlayerElement } from './element.js';

MatteboxPlayerElement.define();
