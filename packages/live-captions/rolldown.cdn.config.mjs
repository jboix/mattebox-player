import { defineConfig } from 'rolldown';
import { inlineCss } from '../../scripts/lib/inline-css.mjs';

// The CDN bundle: one minified IIFE behind the `matteboxPlayerLiveCaptions`
// global. The player is reached for its types only, and the engine is not
// imported at all. The page loads the engine, the player and then this.
export default defineConfig({
  input: 'cdn/live-captions.ts',
  external: [/^mattebox(\/|$)/, /^@mattebox\/player(\/|$)/],
  plugins: [inlineCss()],
  output: {
    file: 'dist/cdn/mattebox-player-live-captions.min.js',
    format: 'iife',
    name: 'matteboxPlayerLiveCaptions',
    exports: 'named',
    globals: (id) => (id === 'mattebox' ? 'mattebox' : 'matteboxPlayer'),
    minify: true,
  },
  transform: { target: 'es2015' },
});
