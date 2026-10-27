import { defineConfig } from 'rolldown';

// The CDN bundle: one minified IIFE behind the `matteboxPlayerPreferences` global.
// It takes the engine's track helpers from the engine's global, and the
// player for its types alone; the page loads the engine, the player and then this.
export default defineConfig({
  input: 'cdn/preferences.ts',
  external: [/^mattebox(\/|$)/, /^@mattebox\/player(\/|$)/],
  output: {
    file: 'dist/cdn/mattebox-player-preferences.min.js',
    format: 'iife',
    name: 'matteboxPlayerPreferences',
    exports: 'named',
    globals: (id) => (id === 'mattebox' ? 'mattebox' : 'matteboxPlayer'),
    minify: true,
  },
  transform: { target: 'es2015' },
});
