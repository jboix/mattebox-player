import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { alias } from './vitest.alias.js';

type Browser = 'chromium' | 'firefox' | 'webkit';

/**
 * The browser tier in one browser. Each browser is a project of its own so
 * it can carry a `groupOrder`: Vitest runs the projects of one order together
 * and the orders in sequence, so the three browsers run one after another
 * rather than side by side. Together they starved each other on a small
 * machine and left a run stuck now and then. Project names are unique, so
 * the parent takes the browser's name and the instance keeps the name the
 * reports always showed, `browser (chromium)`; `--project='browser*'`
 * selects all three.
 */
function browserProject(browser: Browser, order: number) {
  return {
    resolve: { alias },
    test: {
      name: browser,
      include: ['packages/*/test/browser/**/*.test.ts'],
      setupFiles: ['./test/browser/setup.ts'],
      sequence: { groupOrder: order },
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        instances: [{ browser, name: `browser (${browser})` }],
      },
    },
  };
}

export default defineConfig({
  resolve: { alias },
  test: {
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**'],
      // `test:coverage` merges the node tier and the Chromium browser tier,
      // which covers the element and the UI. v8 instruments Chromium only.
      exclude: ['packages/core/src/index.ts', 'packages/core/src/types.ts'],
      // The measured figures on 2026-10-16 minus two points. Raise them
      // when coverage rises; never lower them to pass.
      thresholds: { statements: 89, branches: 76, functions: 88, lines: 92 },
      // json-summary and json feed the PR coverage comment.
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
      browserProject('chromium', 1),
      browserProject('firefox', 2),
      browserProject('webkit', 3),
    ],
  },
});
