import { defineConfig } from 'rolldown';

// The CDN bundle: one minified IIFE behind the `matteboxPlayerCast`
// global. The engine is read from the `mattebox` global, the same as the
// player's bundle, and the page loads the engine, the player and then this.
export default defineConfig({
  input: 'cdn/cast.ts',
  external: [/^mattebox(\/|$)/, /^@mattebox\/player(\/|$)/],
  output: {
    file: 'dist/cdn/mattebox-player-cast.min.js',
    format: 'iife',
    name: 'matteboxPlayerCast',
    exports: 'named',
    globals: (id) => (id === 'mattebox' ? 'mattebox' : 'matteboxPlayer'),
    minify: true,
  },
  transform: { target: 'es2015' },
});
