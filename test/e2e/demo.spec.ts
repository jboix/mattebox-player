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
  // The default composition, appended to the element's own light DOM.
  await expect(page.locator('mattebox-player > mbx-control-bar')).toHaveCount(1);
  await expect(page.locator('mattebox-player > mbx-control-bar > mbx-play-button')).toHaveCount(1);
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
  await expect(entries).toHaveCount(16);
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
  // Native playback means no engine, so no engine panels under the video.
  const panels = await page.locator('mattebox-player').evaluate((el) => {
    const root = (el as HTMLElement).shadowRoot;
    return root === null ? -1 : root.querySelectorAll('[part~="quality"]').length;
  });
  expect(panels).toBe(0);
});

test('the controls option swaps the bar for the native controls, and the markup follows', async ({
  page,
}) => {
  await page.goto('/?row=none');
  await expect(page.locator('mattebox-player > mbx-control-bar')).toHaveCount(1);
  await expect(page.locator('#markup')).toContainText('controls="custom"');
  await page.locator('#controls').selectOption('native');
  await expect(page.locator('mattebox-player > video')).toHaveAttribute('controls', '');
  await expect(page.locator('mattebox-player > mbx-control-bar')).toHaveCount(0);
  await expect(page.locator('#markup')).not.toContainText('controls=');
});

test('the layout lists, the knobs and the language shape the bar and the markup', async ({
  page,
}) => {
  await page.goto('/?row=none');
  const bar = page.locator('mattebox-player > mbx-control-bar');
  await expect(bar.locator('mbx-fullscreen-button')).toHaveCount(1);
  await expect(bar.locator('mbx-drm-badge')).toHaveCount(0);

  await page.locator('#layout-right li[data-name="fullscreen"] input').uncheck();
  await expect(bar.locator('mbx-fullscreen-button')).toHaveCount(0);
  await expect(page.locator('#markup')).not.toContainText('mbx-fullscreen-button');
  await page.locator('#layout-right li[data-name="drm"] input').check();
  await expect(bar.locator('mbx-drm-badge')).toHaveCount(1);

  await page.locator('[data-knob="skip-forward"]').fill('30');
  await expect(bar.locator('mbx-skip-button').nth(1)).toHaveAttribute('seconds', '30');
  await expect(page.locator('#markup')).toContainText('seconds="30"');
  await page.locator('[data-knob="idle-ms"]').fill('1000');
  await expect(bar).toHaveAttribute('idle-ms', '1000');

  await page.locator('[data-screen="start"]').uncheck();
  await expect(page.locator('mattebox-player > mbx-start-button')).toHaveCount(0);

  await page.locator('#language').selectOption('ca');
  const play = bar.locator('mbx-play-button');
  await expect(play).toHaveAttribute('label-play', 'Reproduir');
  const name = await play.evaluate(
    (el) => el.shadowRoot?.querySelector('button')?.getAttribute('aria-label') ?? '',
  );
  expect(name).toBe('Reproduir');
  await expect(bar.locator('mbx-skip-button').first()).toHaveAttribute(
    'label',
    'Enrere {seconds} segons',
  );
  await expect(page.locator('#markup')).toContainText('label-play="Reproduir"');
  await page.locator('#language').selectOption('ja');
  await expect(play).toHaveAttribute('label-play', '再生');
  await expect(page.locator('#language option')).toHaveCount(12);
  await page.locator('#language').selectOption('en');
  await expect(play).not.toHaveAttribute('label-play');
});

test('a control dragged to another row lands there', async ({ page }) => {
  await page.goto('/?row=none');
  const bar = page.locator('mattebox-player > mbx-control-bar');
  // The volume from the left to the seek row, by the drop the lists take.
  await page.locator('#layout-left li[data-name="volume"]').dragTo(page.locator('#layout-seek'));
  await expect(page.locator('#layout-seek li[data-name="volume"]')).toHaveCount(1);
  await expect(bar.locator('mbx-volume')).toHaveAttribute('slot', 'seek');
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
  await page.locator('[data-flag="autoplay"]').check();
  await page.locator('#layout-right li[data-name="fullscreen"] input').uncheck();
  await page.locator('[data-knob="skip-forward"]').fill('15');
  await page.locator('#language').selectOption('ca');
  await page.reload();
  await expect(page.locator('[data-flag="autoplay"]')).toBeChecked();
  await expect(page.locator('#layout-right li[data-name="fullscreen"] input')).not.toBeChecked();
  await expect(page.locator('[data-knob="skip-forward"]')).toHaveValue('15');
  await expect(page.locator('#language')).toHaveValue('ca');
  const bar = page.locator('mattebox-player > mbx-control-bar');
  await expect(bar.locator('mbx-skip-button').nth(1)).toHaveAttribute('seconds', '15');
  await expect(bar.locator('mbx-fullscreen-button')).toHaveCount(0);

  // Reset forgets it all.
  await page.locator('#reset-options').click();
  await expect(page.locator('[data-knob="skip-forward"]')).toHaveValue('10');
  await expect(page.locator('#layout-right li[data-name="fullscreen"] input')).toBeChecked();
  await expect(page.locator('#language')).toHaveValue('en');
  await expect(bar.locator('mbx-fullscreen-button')).toHaveCount(1);
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
