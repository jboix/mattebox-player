import { defineConfig } from 'rolldown';
import { inlineCss } from '../../scripts/lib/inline-css.mjs';

// The CDN bundle: one minified IIFE behind the `matteboxPlayer360`
// global. The player is reached for its types only, and the engine is not
// imported at all. The page loads the engine, the player and then this.
export default defineConfig({
  input: 'cdn/360.ts',
  external: [/^mattebox(\/|$)/, /^@mattebox\/player(\/|$)/],
  plugins: [inlineCss()],
  output: {
    file: 'dist/cdn/mattebox-player-360.min.js',
    format: 'iife',
    name: 'matteboxPlayer360',
    exports: 'named',
    globals: (id) => (id === 'mattebox' ? 'mattebox' : 'matteboxPlayer'),
    minify: true,
  },
  transform: { target: 'es2015' },
});
