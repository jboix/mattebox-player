import { expect, test } from '@playwright/test';

// The hosted demo, built the way users get it. The rows that reach the
// internet are not asserted on: this suite proves the page, the routing it
// can do locally, and the element inside it.
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

test('every source kind has a row, with the type its extension implies', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('#sources tbody tr');
  await expect(rows).toHaveCount(7);

  const table = await rows.evaluateAll((list) =>
    list.map((row) => {
      const cells = [...row.querySelectorAll('td')];
      return [cells[0]?.firstChild?.textContent ?? '', cells[2]?.textContent ?? ''];
    }),
  );
  expect(table).toEqual([
    ['HLS VOD', 'application/vnd.apple.mpegurl'],
    ['DASH VOD', 'application/dash+xml'],
    ['DASH live', 'application/dash+xml'],
    ['mp3', 'audio/mpeg'],
    ['Progressive mp4', 'video/mp4'],
    // A blob URL has no extension, so nothing is inferred and both handlers
    // see the source as a maybe.
    ['Extensionless URL', '—'],
    ['ClearKey DASH', 'application/dash+xml'],
  ]);
});

test('the extensionless row falls through to the native handler', async ({ page }) => {
  await page.goto('/');
  // The only row that reaches no network: the page builds the media itself.
  const row = page.locator('#sources tbody tr').nth(5);
  await row.click();

  await expect(row.locator('td').nth(3)).toHaveText('native', { timeout: 15_000 });
  await expect(row).toHaveClass(/playing/);
  // Native playback means no engine, so no engine panels.
  const menus = await page.locator('mattebox-player').evaluate((el) => {
    const root = (el as HTMLElement & { shadowRoot: ShadowRoot | null }).shadowRoot;
    return root === null ? -1 : root.querySelectorAll('[part~="quality"], [part~="tracks"]').length;
  });
  expect(menus).toBe(0);
});
