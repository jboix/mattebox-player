import { defineConfig } from 'rolldown';
import { inlineCss } from '../../scripts/lib/inline-css.mjs';

// The CDN bundle: one minified IIFE behind the `matteboxPlayerSpatialNav` global.
// It takes nothing from the engine or the player at runtime; the page loads
// the engine, the player and then this.
// The game controller is a second bundle, with the spatial navigation in
// it, so a page with a remote alone loads the first.
const bundle = (input, file) =>
  defineConfig({
    input,
    external: [/^mattebox(\/|$)/, /^@mattebox\/player(\/|$)/],
    plugins: [inlineCss()],
    output: {
      file,
      format: 'iife',
      name: 'matteboxPlayerSpatialNav',
      exports: 'named',
      globals: (id) => (id === 'mattebox' ? 'mattebox' : 'matteboxPlayer'),
      minify: true,
    },
    transform: { target: 'es2015' },
  });

export default [
  bundle('cdn/spatial-nav.ts', 'dist/cdn/mattebox-player-spatial-nav.min.js'),
  bundle('cdn/gamepad.ts', 'dist/cdn/mattebox-player-spatial-nav-gamepad.min.js'),
];
