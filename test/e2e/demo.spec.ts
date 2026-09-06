import { expect, test } from '@playwright/test';

// The hosted demo, built the way users get it: the element upgrades, carries
// its native video, and the page's logo resolves.
test('the demo page upgrades <mattebox-player>', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('mattebox-player')).toBeVisible();
  await expect(page.locator('mattebox-player > video')).toHaveAttribute('controls', '');
  const defined = await page.evaluate(() => customElements.get('mattebox-player') !== undefined);
  expect(defined).toBe(true);
});

test('the logo loads', async ({ page }) => {
  await page.goto('/');
  const logo = page.locator('img.logo');
  await expect(logo).toBeVisible();
  await expect
    .poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true);
});
