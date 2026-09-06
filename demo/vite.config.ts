import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The demo imports the workspace packages by name and gets their sources, so
// HMR works against source and no build is needed first. Pass `--base` for
// the subpath the hosted build is served from.
export default defineConfig({
  resolve: {
    alias: {
      '@mattebox/player-core': fileURLToPath(
        new URL('../packages/core/src/index.ts', import.meta.url),
      ),
      '@mattebox/player': fileURLToPath(
        new URL('../packages/player/src/index.ts', import.meta.url),
      ),
    },
  },
  // The logo is imported from docs/, outside the demo root.
  server: {
    fs: { allow: ['..'] },
  },
  build: {
    // The hosted demo is lowered to the same target as the packages' default
    // build, so a deployment exercises what users ship.
    target: 'es2015',
  },
});
