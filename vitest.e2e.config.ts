import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { signedUrl } from './demo/signed-url.js';
import { alias } from './vitest.alias.js';

type Browser = 'chromium' | 'firefox' | 'webkit';

/** The presets the demo's selector offers, each an entry of the engine. */
const PRESETS = [
  'full',
  'dual',
  'dual-drm',
  'dual-ts',
  'dual-ts-drm',
  'hls',
  'hls-drm',
  'hls-ts',
  'hls-ts-drm',
  'dash',
  'dash-drm',
  'kernel',
].map((name) => `mattebox/presets/${name}`);

/**
 * The demo page in one browser. The tests run inside the page, over the demo's
 * sources through the same aliases as the unit tiers, and the demo's own
 * signed-URL route is served from the test origin. Each project is its own
 * Vite server, so each carries the plugin.
 */
function browserProject(browser: Browser, order: number) {
  return {
    plugins: [signedUrl()],
    resolve: { alias },
    // The demo imports the engine and every preset. Named here so Vite
    // bundles them before the first test, rather than finding them during
    // it and reloading the page.
    optimizeDeps: { include: ['mattebox', ...PRESETS, 'mattebox/stages/eme-core'] },
    test: {
      name: browser,
      include: ['test/e2e/**/*.test.ts'],
      setupFiles: ['./test/browser/setup.ts'],
      // The browsers run one after another, as under vitest.config.ts.
      sequence: { groupOrder: order },
      testTimeout: 30_000,
      hookTimeout: 30_000,
      retry: process.env.CI ? 2 : 0,
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        // The desktop size the suite always ran at: the page's wide layout,
        // with the options beside the player rather than under it.
        viewport: { width: 1280, height: 720 },
        // A failure is an attribute or a count; a picture of the page would not
        // say which.
        screenshotFailures: false,
        instances: [{ browser }],
      },
    },
  };
}

// The demo page in three browsers: the element upgrades, its panels render,
// and the options on the side shape the markup. Stream playback is the
// engine's E2E suite, not this one. The unit and browser tiers run under
// vitest.config.ts.
export default defineConfig({
  test: {
    projects: [
      browserProject('chromium', 1),
      browserProject('firefox', 2),
      browserProject('webkit', 3),
    ],
  },
});
