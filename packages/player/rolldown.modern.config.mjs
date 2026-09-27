import { globSync } from 'node:fs';
import { basename } from 'node:path';
import { defineConfig } from 'rolldown';
import { inlineCss } from '../../scripts/lib/inline-css.mjs';

// The modern artifact under dist/: src/ at ES2022, the module structure
// preserved, each control's CSS inlined. tsc writes the declarations beside
// it. The core and the engine stay imports.
export default defineConfig({
  input: {
    index: 'src/index.ts',
    'element-entry': 'src/element-entry.ts',
    ...Object.fromEntries(
      globSync('src/entries/*.ts').map((file) => [`entries/${basename(file, '.ts')}`, file]),
    ),
  },
  external: [/^mattebox(\/|$)/, '@mattebox/player-core'],
  plugins: [inlineCss()],
  output: {
    dir: 'dist',
    format: 'esm',
    preserveModules: true,
    preserveModulesRoot: 'src',
    entryFileNames: '[name].js',
    chunkFileNames: '[name].js',
    sourcemap: true,
  },
  transform: { target: 'es2022' },
});
