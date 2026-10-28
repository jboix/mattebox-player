/**
 * The demo's connectors, one per broadcaster whose API answers other
 * origins. The player gets the connectors; the demo's picker gets the rest.
 * A connector goes when its broadcaster closes its API.
 */
import { ardDemo } from './ard.js';
import { dwDemo } from './dw.js';
import { srgssrDemo } from './srgssr.js';
import { svtDemo } from './svt.js';
import { threecatDemo } from './threecat.js';
import type { DemoConnector } from './types.js';

export type { DemoConnector, Example } from './types.js';

export const DEMO_CONNECTORS: readonly DemoConnector[] = [
  srgssrDemo,
  svtDemo,
  ardDemo,
  threecatDemo,
  dwDemo,
];

export const CONNECTORS = DEMO_CONNECTORS.map((entry) => entry.connector);
