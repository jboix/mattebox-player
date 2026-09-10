import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// Tests import the workspace packages by name and get their sources, the
// same mapping as tsconfig.json's paths, so no build is needed first.
const alias = [
  {
    find: '@mattebox/player-core',
    replacement: fileURLToPath(new URL('packages/core/src/index.ts', import.meta.url)),
  },
  {
    find: '@mattebox/player/element',
    replacement: fileURLToPath(new URL('packages/player/src/element-entry.ts', import.meta.url)),
  },
  {
    find: /^@mattebox\/player\/elements\/(.+)$/,
    replacement: fileURLToPath(new URL('packages/player/src/entries/$1.ts', import.meta.url)),
  },
  {
    find: /^@mattebox\/player$/,
    replacement: fileURLToPath(new URL('packages/player/src/index.ts', import.meta.url)),
  },
  {
    find: '@mattebox/player-diagnostics',
    replacement: fileURLToPath(new URL('packages/diagnostics/src/index.ts', import.meta.url)),
  },
];

export default defineConfig({
  resolve: { alias },
  test: {
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**'],
      // v8 cannot instrument Firefox or WebKit; coverage measures the node tier.
      exclude: [
        'packages/player/src/**',
        'packages/diagnostics/src/**',
        'packages/core/src/index.ts',
        'packages/core/src/types.ts',
      ],
      // json-summary and json feed the PR coverage comment. No thresholds.
      reporter: ['text', 'json-summary', 'json'],
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['packages/*/test/node/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'browser',
          include: ['packages/*/test/browser/**/*.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
          },
        },
      },
    ],
  },
});
