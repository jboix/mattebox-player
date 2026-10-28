import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { signedUrl } from './signed-url.js';

// The demo imports the workspace packages by name and gets their sources, so
// HMR works against source and no build is needed first. Pass `--base` for
// the subpath the hosted build is served from.
export default defineConfig({
  plugins: [signedUrl()],
  resolve: {
    // Each package's languages first: the package names below would match
    // their subpaths too.
    alias: [
      {
        find: /^@mattebox\/player-diagnostics\/locales\/(.+)$/,
        replacement: fileURLToPath(
          new URL('../packages/diagnostics/src/locales/$1.ts', import.meta.url),
        ),
      },
      {
        find: /^@mattebox\/player-cast\/locales\/(.+)$/,
        replacement: fileURLToPath(new URL('../packages/cast/src/locales/$1.ts', import.meta.url)),
      },
      {
        find: /^@mattebox\/player-playlist\/locales\/(.+)$/,
        replacement: fileURLToPath(
          new URL('../packages/playlist/src/locales/$1.ts', import.meta.url),
        ),
      },
      {
        find: /^@mattebox\/player\/locales\/(.+)$/,
        replacement: fileURLToPath(
          new URL('../packages/player/src/locales/$1.ts', import.meta.url),
        ),
      },
      {
        find: '@mattebox/player-core',
        replacement: fileURLToPath(new URL('../packages/core/src/index.ts', import.meta.url)),
      },
      {
        find: '@mattebox/player-diagnostics',
        replacement: fileURLToPath(
          new URL('../packages/diagnostics/src/index.ts', import.meta.url),
        ),
      },
      {
        find: '@mattebox/player-cast',
        replacement: fileURLToPath(new URL('../packages/cast/src/index.ts', import.meta.url)),
      },
      {
        find: '@mattebox/player-spatial-nav',
        replacement: fileURLToPath(
          new URL('../packages/spatial-nav/src/index.ts', import.meta.url),
        ),
      },
      {
        find: '@mattebox/player-preferences',
        replacement: fileURLToPath(
          new URL('../packages/preferences/src/index.ts', import.meta.url),
        ),
      },
      {
        find: '@mattebox/player-playlist',
        replacement: fileURLToPath(new URL('../packages/playlist/src/index.ts', import.meta.url)),
      },
      {
        find: '@mattebox/player',
        replacement: fileURLToPath(new URL('../packages/player/src/index.ts', import.meta.url)),
      },
    ],
  },
  // The logo is imported from docs/, outside the demo root.
  server: {
    fs: { allow: ['..'] },
  },
  build: {
    // The hosted demo is lowered to the same target as the packages' default
    // build, so a deployment exercises what users ship.
    target: 'es2015',
    // Three pages: the element, the playlist, and the reels feed.
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        playlist: fileURLToPath(new URL('playlist.html', import.meta.url)),
        reels: fileURLToPath(new URL('reels.html', import.meta.url)),
      },
    },
  },
});
