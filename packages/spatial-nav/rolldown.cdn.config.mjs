import { defineConfig } from 'rolldown';

// The CDN bundle: one minified IIFE behind the `matteboxPlayerSpatialNav` global.
// It takes nothing from the engine or the player at runtime; the page loads
// the engine, the player and then this.
export default defineConfig({
  input: 'cdn/spatial-nav.ts',
  external: [/^mattebox(\/|$)/, /^@mattebox\/player(\/|$)/],
  output: {
    file: 'dist/cdn/mattebox-player-spatial-nav.min.js',
    format: 'iife',
    name: 'matteboxPlayerSpatialNav',
    exports: 'named',
    globals: (id) => (id === 'mattebox' ? 'mattebox' : 'matteboxPlayer'),
    minify: true,
  },
  transform: { target: 'es2015' },
});
