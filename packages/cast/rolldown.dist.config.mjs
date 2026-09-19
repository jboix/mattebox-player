import { defineConfig } from 'rolldown';

// The default artifact: src/ lowered to ES2015 with the module structure
// preserved. The modern build under dist/ comes from tsc. The engine stays
// an import; the player is reached for its types only.
export default defineConfig({
  input: { index: 'src/index.ts' },
  external: [/^mattebox(\/|$)/, /^@mattebox\/player(\/|$)/],
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
