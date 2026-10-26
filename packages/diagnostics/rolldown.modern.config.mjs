import { globSync } from 'node:fs';
import { basename } from 'node:path';
import { defineConfig } from 'rolldown';
import { inlineCss } from '../../scripts/lib/inline-css.mjs';

// The modern artifact under dist/: src/ at ES2022, the module structure
// preserved, its CSS inlined. tsc writes the declarations beside it. The
// engine and the player stay imports.
export default defineConfig({
  input: {
    index: 'src/index.ts',
    // One entry per language, which a page imports or loads on its own.
    ...Object.fromEntries(
      globSync('src/locales/*.ts').map((file) => [`locales/${basename(file, '.ts')}`, file]),
    ),
  },
  external: [/^mattebox(\/|$)/, /^@mattebox\/player(\/|$)/],
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
