import { expect, test } from '@playwright/test';

// The hosted demo, built the way users get it. The rows that reach the
// internet are not asserted on: this suite proves the page, the routing it
// can do locally, and the element inside it.
test('the demo page upgrades <mattebox-player> with its own bar', async ({ page }) => {
  await page.goto('/?row=none');
  await expect(page.locator('mattebox-player')).toBeVisible();
  // The demo opens on the element's own bar, so the video has no native controls.
  await expect(page.locator('mattebox-player > video')).not.toHaveAttribute('controls');
  await expect(page.locator('mattebox-player')).toHaveAttribute('controls', 'custom');
  const defined = await page.evaluate(() => customElements.get('mattebox-player') !== undefined);
  expect(defined).toBe(true);
  const parts = await page.locator('mattebox-player').evaluate((el) => {
    const root = (el as HTMLElement).shadowRoot;
    return root === null ? [] : [...root.querySelectorAll('[part~="control"]')].length;
  });
  expect(parts).toBeGreaterThan(5);
});

test('the logo loads', async ({ page }) => {
  await page.goto('/?row=none');
  const logo = page.locator('img.logo');
  await expect(logo).toBeVisible();
  await expect
    .poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true);
});

test('the chooser opens from the masthead and lists the demo streams', async ({ page }) => {
  await page.goto('/?row=none');
  await expect(page.locator('#content-dialog')).toBeHidden();
  await page.locator('#open-content').click();
  await expect(page.locator('#content-dialog')).toBeVisible();
  const entries = page.locator('#stream-list li');
  await expect(entries).toHaveCount(18);
  await expect(entries.last()).toContainText('Extensionless URL');
});

test('the extensionless entry falls through to the native handler', async ({ page }) => {
  // Idle on arrival, so the choice is the only load in flight.
  await page.goto('/?row=none');
  // The only entry that reaches no network: the page builds the media itself.
  await page.locator('#open-content').click();
  await page.locator('#stream-list button', { hasText: 'Extensionless URL' }).click();
  // A choice closes the chooser and the status says who took it.
  await expect(page.locator('#content-dialog')).toBeHidden();
  await expect(page.locator('#status')).toHaveText(/the browser/, { timeout: 15_000 });
  // Native playback means no engine, so no engine menus in the bar.
  const menus = await page.locator('mattebox-player').evaluate((el) => {
    const root = (el as HTMLElement).shadowRoot;
    return root === null ? -1 : root.querySelectorAll('[part~="quality-menu"]').length;
  });
  expect(menus).toBe(0);
});

test('the options shape the bar and the markup', async ({ page }) => {
  await page.goto('/?row=none');
  const has = (name: string) =>
    page.locator('mattebox-player').evaluate((el, part) => {
      const root = (el as HTMLElement).shadowRoot;
      return root !== null && root.querySelector(`[part~="${part}"]`) !== null;
    }, name);
  expect(await has('fullscreen-button')).toBe(true);
  await page.locator('#layout-right li[data-name="fullscreen"] input').uncheck();
  expect(await has('fullscreen-button')).toBe(false);
  await expect(page.locator('#markup')).toContainText('layout="');
  await expect(page.locator('#markup')).not.toContainText('fullscreen');

  await page.locator('[data-knob="skip-forward"]').fill('30');
  await expect(page.locator('#markup')).toContainText('skip-forward="30"');
  const glyph = await page.locator('mattebox-player').evaluate((el) => {
    const root = (el as HTMLElement).shadowRoot;
    return root?.querySelector('[part~="skip-forward-button"] svg')?.getAttribute('part') ?? '';
  });
  expect(glyph).toContain('seek-forward-30-icon');

  await page.locator('#controls').selectOption('native');
  await expect(page.locator('mattebox-player > video')).toHaveAttribute('controls', '');
  await expect(page.locator('#markup')).not.toContainText('controls=');
});

test('the media options set the attributes the element forwards or reads', async ({ page }) => {
  await page.goto('/?row=none');
  const player = page.locator('mattebox-player');
  await expect(player).toHaveAttribute('muted', '');
  await expect(page.locator('#markup')).toContainText('muted');
  await page.locator('[data-flag="muted"]').uncheck();
  await expect(player).not.toHaveAttribute('muted');
  await expect(page.locator('#markup')).not.toContainText('muted');
  await page.locator('[data-flag="autoplay"]').check();
  await expect(player).toHaveAttribute('autoplay', '');
  await expect(page.locator('mattebox-player > video')).toHaveAttribute('autoplay', '');
  await page.locator('#preset').selectOption('hls');
  await expect(page.locator('#markup')).toContainText('preset="hls"');
  await page.locator('[data-look="subtitle-size"]').selectOption('large');
  await expect(player).toHaveAttribute('subtitle-size', 'large');
  await expect(page.locator('#markup')).toContainText('subtitle-size="large"');
});

test('the theme toggle switches rooms and remembers the choice', async ({ page }) => {
  await page.goto('/?row=none');
  const toggle = page.locator('#theme-toggle');
  // Headless browsers report a light system, so the button offers the dark room.
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  await expect(toggle).toHaveText(/Dark/);
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveText(/Light/);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('the options are remembered across a reload', async ({ page }) => {
  await page.goto('/?row=none');
  await page.locator('#layout-right li[data-name="fullscreen"] input').uncheck();
  await page.locator('[data-knob="skip-forward"]').fill('15');
  await page.locator('[data-knob-flag="start"]').uncheck();
  await page.reload();
  await expect(page.locator('#layout-right li[data-name="fullscreen"] input')).not.toBeChecked();
  await expect(page.locator('[data-knob="skip-forward"]')).toHaveValue('15');
  await expect(page.locator('mattebox-player')).toHaveAttribute('skip-forward', '15');
  await expect(page.locator('mattebox-player')).toHaveAttribute('start', '0');
  await expect(page.locator('#markup')).toContainText('start="0"');

  // Reset forgets it all.
  await page.locator('#reset-options').click();
  await expect(page.locator('[data-knob="skip-forward"]')).toHaveValue('10');
  await expect(page.locator('#layout-right li[data-name="fullscreen"] input')).toBeChecked();
  await expect(page.locator('mattebox-player')).not.toHaveAttribute('start');
});

test('the SRG SSR route is there, and idle until asked', async ({ page }) => {
  await page.goto('/?row=none');
  await page.locator('#open-content').click();
  await page.locator('[data-route="srgssr"]').click();
  await expect(page.locator('#route-srgssr')).toBeVisible();
  await expect(page.locator('#route-static')).toBeHidden();
  await expect(page.locator('#search-bu option')).toHaveCount(5);
  await expect(page.locator('#search-results')).toBeHidden();
});
