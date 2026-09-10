import { defineConfig } from 'rolldown';

// The CDN bundle: one minified IIFE behind the `matteboxPlayerDiagnostics`
// global. The engine is read from the `mattebox` global, the same as the
// player's bundle, and the page loads the engine, the player and then this.
export default defineConfig({
  input: 'cdn/diagnostics.ts',
  external: [/^mattebox(\/|$)/, /^@mattebox\/player(\/|$)/],
  output: {
    file: 'dist/cdn/mattebox-player-diagnostics.min.js',
    format: 'iife',
    name: 'matteboxPlayerDiagnostics',
    exports: 'named',
    globals: (id) => (id === 'mattebox' ? 'mattebox' : 'matteboxPlayer'),
    minify: true,
  },
  transform: { target: 'es2015' },
});
