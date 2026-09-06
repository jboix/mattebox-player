// Importing the core's built entry in isolation must register nothing: no
// global, no custom element, no engine. The element package registers
// <mattebox-player> on import by design and is not audited. Needs `npm run build`.
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { fail } from './lib/fail.mjs';

const entry = 'packages/core/dist/index.js';
if (!existsSync(entry)) fail(`${entry} is missing; run npm run build first`);

const before = new Set(Object.getOwnPropertyNames(globalThis));
await import(pathToFileURL(entry).href);

const leaked = Object.getOwnPropertyNames(globalThis).filter((key) => !before.has(key));
if (leaked.length > 0) fail(`importing the core created globals: ${leaked.join(', ')}`);

console.log('side-effect audit passed (the core imports cleanly)');
