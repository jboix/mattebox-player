import { defineConfig } from 'rolldown';

// The CDN bundle: one minified IIFE behind the `matteboxPlayer` global, the
// core inside. The engine is not: the page loads the engine bundle of the
// preset it wants first, and this bundle reads the `mattebox` global, so the
// size story stays the engine's. docs/guide/04-cdn.md has the script tags.
export default defineConfig({
  input: 'cdn/player.ts',
  external: [/^mattebox(\/|$)/],
  output: {
    file: 'dist/cdn/mattebox-player.min.js',
    format: 'iife',
    name: 'matteboxPlayer',
    exports: 'named',
    // The root import is the global; a preset subpath is the global's `preset`.
    globals: (id) => (id === 'mattebox' ? 'mattebox' : 'mattebox.preset'),
    minify: true,
  },
  // The default target, the same as dist/es2015.
  transform: { target: 'es2015' },
});
