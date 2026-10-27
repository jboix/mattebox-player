import { fileURLToPath } from 'node:url';

/**
 * Tests import the workspace packages by name and get their sources, the
 * same mapping as tsconfig.json's paths, so no build is needed first. Both
 * Vitest configs, the unit tiers and the demo page suite, resolve through it.
 */
export const alias = [
  // Each package's languages first: the package names below would match their subpaths too.
  {
    find: /^@mattebox\/player\/locales\/(.+)$/,
    replacement: fileURLToPath(new URL('packages/player/src/locales/$1.ts', import.meta.url)),
  },
  {
    find: /^@mattebox\/player-playlist\/locales\/(.+)$/,
    replacement: fileURLToPath(new URL('packages/playlist/src/locales/$1.ts', import.meta.url)),
  },
  {
    find: /^@mattebox\/player-cast\/locales\/(.+)$/,
    replacement: fileURLToPath(new URL('packages/cast/src/locales/$1.ts', import.meta.url)),
  },
  {
    find: /^@mattebox\/player-diagnostics\/locales\/(.+)$/,
    replacement: fileURLToPath(new URL('packages/diagnostics/src/locales/$1.ts', import.meta.url)),
  },
  {
    find: '@mattebox/player-core',
    replacement: fileURLToPath(new URL('packages/core/src/index.ts', import.meta.url)),
  },
  {
    find: '@mattebox/player/element',
    replacement: fileURLToPath(new URL('packages/player/src/element-entry.ts', import.meta.url)),
  },
  {
    find: /^@mattebox\/player\/elements\/(.+)$/,
    replacement: fileURLToPath(new URL('packages/player/src/entries/$1.ts', import.meta.url)),
  },
  {
    find: /^@mattebox\/player$/,
    replacement: fileURLToPath(new URL('packages/player/src/index.ts', import.meta.url)),
  },
  {
    find: '@mattebox/player-diagnostics',
    replacement: fileURLToPath(new URL('packages/diagnostics/src/index.ts', import.meta.url)),
  },
  {
    find: '@mattebox/player-cast',
    replacement: fileURLToPath(new URL('packages/cast/src/index.ts', import.meta.url)),
  },
  {
    find: '@mattebox/player-spatial-nav',
    replacement: fileURLToPath(new URL('packages/spatial-nav/src/index.ts', import.meta.url)),
  },
  {
    find: '@mattebox/player-preferences',
    replacement: fileURLToPath(new URL('packages/preferences/src/index.ts', import.meta.url)),
  },
  {
    find: '@mattebox/player-playlist',
    replacement: fileURLToPath(new URL('packages/playlist/src/index.ts', import.meta.url)),
  },
];
