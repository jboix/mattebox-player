import { defineConfig } from 'rolldown';
import { inlineCss } from '../../scripts/lib/inline-css.mjs';

// The CDN bundle: one minified IIFE behind the `matteboxPlayerTranscript`
// global. The engine is read from the `mattebox` global, the same as the
// player's bundle, except the transcript stage, which the engine's CDN
// bundle leaves out: it is bundled here. The page loads the engine, the
// player and then this.
export default defineConfig({
  input: 'cdn/transcript.ts',
  external: (id) =>
    (/^mattebox(\/|$)/.test(id) && id !== 'mattebox/stages/transcript') ||
    /^@mattebox\/player(\/|$)/.test(id),
  plugins: [inlineCss()],
  output: {
    file: 'dist/cdn/mattebox-player-transcript.min.js',
    format: 'iife',
    name: 'matteboxPlayerTranscript',
    exports: 'named',
    globals: (id) => (id === 'mattebox' ? 'mattebox' : 'matteboxPlayer'),
    minify: true,
  },
  transform: { target: 'es2015' },
});
