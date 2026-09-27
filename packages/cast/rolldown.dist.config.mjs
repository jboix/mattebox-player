import { defineConfig } from 'rolldown';
import { inlineCss } from '../../scripts/lib/inline-css.mjs';

// The default artifact: src/ lowered to ES2015 with the module structure
// preserved, each element's CSS inlined. The modern build under dist/ comes
// from rolldown.modern.config.mjs. The engine stays an import; the player is
// reached for its types only.
export default defineConfig({
  input: { index: 'src/index.ts' },
  external: [/^mattebox(\/|$)/, /^@mattebox\/player(\/|$)/],
  plugins: [inlineCss()],
  output: {
    dir: 'dist/es2015',
    format: 'esm',
    preserveModules: true,
    preserveModulesRoot: 'src',
    entryFileNames: '[name].js',
    chunkFileNames: '[name].js',
  },
  transform: { target: 'es2015' },
});
