/**
 * `@mattebox/player/element`: registers <mattebox-player> and nothing else.
 * A page that takes this entry writes its own composition from the
 * `@mattebox/player/elements/*` entries it imports, and carries only those.
 */
import { MatteboxPlayerElement } from './element.js';

export type { MatteboxPlayerOptions } from './element.js';
export { MatteboxPlayerElement } from './element.js';
export type { PlayerHost } from './host.js';

MatteboxPlayerElement.define();
