import { defineConfig } from 'rolldown';
import { inlineCss } from '../../scripts/lib/inline-css.mjs';

// The CDN bundle: one minified IIFE behind the `matteboxPlayerAds` global.
// The engine is read from the `mattebox` global, the same as the player's
// bundle, except the interstitials stage, which the engine's CDN bundle
// leaves out: it is bundled here. The page loads the engine, the player and
// then this.
export default defineConfig({
  input: 'cdn/ads.ts',
  external: (id) =>
    (/^mattebox(\/|$)/.test(id) && id !== 'mattebox/stages/interstitials') ||
    /^@mattebox\/player(\/|$)/.test(id),
  plugins: [inlineCss()],
  output: {
    file: 'dist/cdn/mattebox-player-ads.min.js',
    format: 'iife',
    name: 'matteboxPlayerAds',
    exports: 'named',
    globals: (id) => (id === 'mattebox' ? 'mattebox' : 'matteboxPlayer'),
    minify: true,
  },
  transform: { target: 'es2015' },
});
