import { globSync } from 'node:fs';
import { basename } from 'node:path';
import { defineConfig } from 'rolldown';
import { inlineCss } from '../../scripts/lib/inline-css.mjs';

// The default artifact: src/ lowered to ES2015 with the module structure
// preserved. The modern build under dist/ comes from tsc. The player is
// reached for its types only.
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
    dir: 'dist/es2015',
    format: 'esm',
    preserveModules: true,
    preserveModulesRoot: 'src',
    entryFileNames: '[name].js',
    chunkFileNames: '[name].js',
  },
  transform: { target: 'es2015' },
});
