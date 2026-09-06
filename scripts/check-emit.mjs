// Banned TypeScript helpers and stray bare imports in the built output of
// every package. Needs `npm run build`.
import { globSync, readFileSync } from 'node:fs';
import { fail } from './lib/fail.mjs';

const BANNED = /__publicField|tslib|regenerator|__decorate|__createBinding|__spreadArray/;
// The modern build imports nothing at runtime beyond the engine and the core.
const ALLOWED_BARE = /^(mattebox(\/.*)?|@mattebox\/player-core)$/;
const IMPORT_SPECIFIER = /(?:from|import)\s*['"]([^'"]+)['"]/g;

const files = globSync('packages/*/dist/**/*.js', {
  exclude: ['**/dist/es2015/**', '**/dist/cdn/**'],
}).sort();
if (files.length === 0) fail('no built modules found; run npm run build first');

const banned = files.filter((file) => BANNED.test(readFileSync(file, 'utf8')));
if (banned.length > 0) fail('banned TypeScript construct found in modern output', banned);

const bare = files.filter((file) =>
  Array.from(readFileSync(file, 'utf8').matchAll(IMPORT_SPECIFIER)).some(
    ([, specifier]) => !specifier.startsWith('.') && !ALLOWED_BARE.test(specifier),
  ),
);
if (bare.length > 0) fail('bare import specifier in output; a runtime dependency leaked in', bare);

console.log(`emit check passed (${files.length} files)`);
