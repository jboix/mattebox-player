import { defineConfig } from 'rolldown';
import { inlineCss } from '../../scripts/lib/inline-css.mjs';

// The default artifact: src/ lowered to ES2015 with the module structure
// preserved, the help bubble's CSS inlined. The modern build under dist/
// comes from rolldown.modern.config.mjs. The player is reached for its
// types only.
export default defineConfig({
  input: { index: 'src/index.ts', 'gamepad-index': 'src/gamepad-index.ts' },
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
