/**
 * The demo page in three browsers: the element upgrades and its panels
 * render, and the options on the side shape the element and the markup. The
 * rows that reach the internet are not asserted on: this suite proves the
 * page, the routing it can do locally, and the element inside it.
 */
import { afterEach, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { accessibleName, mount, unmount, visible } from './harness.js';

/** Sets a checkbox the way a pointer would, and only when it has to change. */
async function setChecked(box: HTMLInputElement, checked: boolean): Promise<void> {
  if (box.checked !== checked) await userEvent.click(box);
}

afterEach(() => {
  unmount();
});

it('the demo page upgrades <mattebox-player> with its own bar', async () => {
  const { $, $$, player } = await mount({ row: 'none' });
  expect(visible(player())).toBe(true);
  // The demo opens on the element's own bar, so the video has no native controls.
  expect($('mattebox-player > video').hasAttribute('controls')).toBe(false);
  expect(player().getAttribute('controls')).toBe('custom');
  expect(customElements.get('mattebox-player')).toBeDefined();
  // The default composition, appended to the element's own light DOM.
  expect($$('mattebox-player > mbx-control-bar')).toHaveLength(1);
  expect($$('mattebox-player > mbx-control-bar > mbx-play-button')).toHaveLength(1);
});

it('the logo loads', async () => {
  const { $ } = await mount({ row: 'none' });
  const logo = $<HTMLImageElement>('img.logo');
  await expect.poll(() => logo.complete && logo.naturalWidth > 0).toBe(true);
  expect(visible(logo)).toBe(true);
});

it('the chooser opens from the masthead and lists the demo streams', async () => {
  const { $, $$ } = await mount({ row: 'none' });
  expect(visible($('#content-dialog'))).toBe(false);
  await userEvent.click($('#open-content'));
  expect(visible($('#content-dialog'))).toBe(true);
  const entries = $$('#stream-list li');
  expect(entries).toHaveLength(16);
  expect(entries.at(-1)?.textContent).toContain('Extensionless URL');
});

it('the extensionless entry falls through to the native handler', async () => {
  // Idle on arrival, so the choice is the only load in flight.
  const { $, $$, player } = await mount({ row: 'none' });
  // The only entry that reaches no network: the page builds the media itself.
  await userEvent.click($('#open-content'));
  const entry = $$('#stream-list button').find((b) => b.textContent?.includes('Extensionless URL'));
  expect(entry).toBeDefined();
  await userEvent.click(entry as HTMLElement);
  // A choice closes the chooser and the status says who took it.
  expect(visible($('#content-dialog'))).toBe(false);
  await expect.poll(() => $('#status').textContent, { timeout: 15_000 }).toMatch(/the browser/);
  // Native playback means no engine, so no engine panels under the video.
  const root = player().shadowRoot;
  expect(root === null ? -1 : root.querySelectorAll('[part~="quality"]').length).toBe(0);
});

it('the controls option swaps the bar for the native controls, and the markup follows', async () => {
  const { $, $$ } = await mount({ row: 'none' });
  expect($$('mattebox-player > mbx-control-bar')).toHaveLength(1);
  expect($('#markup').textContent).toContain('controls="custom"');
  await userEvent.selectOptions($<HTMLSelectElement>('#controls'), 'native');
  expect($('mattebox-player > video').getAttribute('controls')).toBe('');
  expect($$('mattebox-player > mbx-control-bar')).toHaveLength(0);
  expect($('#markup').textContent).not.toContain('controls=');
});

it('the layout lists, the knobs and the language shape the bar and the markup', async () => {
  const { $, $$, bar } = await mount({ row: 'none' });
  expect($$('mbx-fullscreen-button', bar())).toHaveLength(1);
  expect($$('mbx-drm-badge', bar())).toHaveLength(0);

  await setChecked($('#layout-right li[data-name="fullscreen"] input'), false);
  expect($$('mbx-fullscreen-button', bar())).toHaveLength(0);
  expect($('#markup').textContent).not.toContain('mbx-fullscreen-button');
  await setChecked($('#layout-right li[data-name="drm"] input'), true);
  expect($$('mbx-drm-badge', bar())).toHaveLength(1);

  await userEvent.fill($('[data-knob="skip-forward"]'), '30');
  expect($$('mbx-skip-button', bar())[1]?.getAttribute('seconds')).toBe('30');
  expect($('#markup').textContent).toContain('seconds="30"');
  await userEvent.fill($('[data-knob="idle-ms"]'), '1000');
  expect(bar().getAttribute('idle-ms')).toBe('1000');

  await setChecked($('[data-screen="start"]'), false);
  expect($$('mattebox-player > mbx-start-button')).toHaveLength(0);

  // A language re-renders the composition, so the play button is queried anew each time.
  const play = () => $('mbx-play-button', bar());
  await userEvent.selectOptions($<HTMLSelectElement>('#language'), 'ca');
  expect(play().getAttribute('label-play')).toBe('Reproduir');
  expect(accessibleName(play())).toBe('Reproduir');
  expect($$('mbx-skip-button', bar())[0]?.getAttribute('label')).toBe('Enrere {seconds} segons');
  expect($('#markup').textContent).toContain('label-play="Reproduir"');
  await userEvent.selectOptions($<HTMLSelectElement>('#language'), 'ja');
  expect(play().getAttribute('label-play')).toBe('再生');
  expect($$('#language option')).toHaveLength(12);
  await userEvent.selectOptions($<HTMLSelectElement>('#language'), 'en');
  expect(play().hasAttribute('label-play')).toBe(false);
});

it('the chapters menu is in the bar, and the seek bar knob writes chapters="none"', async () => {
  const { $, $$, bar } = await mount({ row: 'none' });
  expect($$('mbx-chapters-menu', bar())).toHaveLength(1);
  // Hidden until the video has a chapters track.
  expect(visible($('mbx-chapters-menu', bar()))).toBe(false);
  expect($('mbx-seek-bar', bar()).hasAttribute('chapters')).toBe(false);
  await userEvent.selectOptions($<HTMLSelectElement>('[data-knob="chapters"]'), 'none');
  expect($('mbx-seek-bar', bar()).getAttribute('chapters')).toBe('none');
  expect($('#markup').textContent).toContain('chapters="none"');
  await userEvent.selectOptions($<HTMLSelectElement>('#language'), 'ca');
  expect($('mbx-chapters-menu', bar()).getAttribute('label')).toBe('Capítols');
});

it('the diagnostics control is off by default, and its import comes with it', async () => {
  const { $, $$, bar } = await mount({ row: 'none' });
  expect($$('mbx-diagnostics', bar())).toHaveLength(0);
  expect($('#markup').textContent).not.toContain('@mattebox/player-diagnostics');
  await setChecked($('#layout-right li[data-name="diagnostics"] input'), true);
  expect($$('mbx-diagnostics', bar())).toHaveLength(1);
  expect($('#markup').textContent).toContain("import '@mattebox/player-diagnostics';");
  // A page's control, upgraded: the button carries its name.
  expect(accessibleName($('mbx-diagnostics', bar()))).toBe('Diagnostics');
  await userEvent.selectOptions($<HTMLSelectElement>('#language'), 'ca');
  expect($('mbx-diagnostics', bar()).getAttribute('label')).toBe('Diagnòstic');
});

it('a chapters track in the chooser reaches the element', async () => {
  const { $, $$, player } = await mount({ row: 'none' });
  await userEvent.click($('#open-content'));
  const entry = $$('#stream-list button').find((b) => b.textContent?.includes('Progressive mp4'));
  expect(entry).toBeDefined();
  await userEvent.click(entry as HTMLElement);
  expect(visible($('#content-dialog'))).toBe(false);
  expect(player().getAttribute('chapters')).toBe('chapters/sintel-trailer.vtt');
  expect($('#markup').textContent).toContain('chapters="chapters/sintel-trailer.vtt"');
  await expect.poll(() => $$('mattebox-player > video > track[kind="chapters"]').length).toBe(1);
});

it('a control dragged to another row lands there', async () => {
  const { $, $$, bar } = await mount({ row: 'none' });
  // The volume from the left to the seek row, by the drop the lists take.
  await userEvent.dragAndDrop($('#layout-left li[data-name="volume"]'), $('#layout-seek'));
  expect($$('#layout-seek li[data-name="volume"]')).toHaveLength(1);
  expect($('mbx-volume', bar()).getAttribute('slot')).toBe('seek');
});

it('the media options set the attributes the element forwards or reads', async () => {
  const { $, player } = await mount({ row: 'none' });
  expect(player().getAttribute('muted')).toBe('');
  expect($('#markup').textContent).toContain('muted');
  await setChecked($('[data-flag="muted"]'), false);
  expect(player().hasAttribute('muted')).toBe(false);
  expect($('#markup').textContent).not.toContain('muted');
  await setChecked($('[data-flag="autoplay"]'), true);
  expect(player().getAttribute('autoplay')).toBe('');
  expect($('mattebox-player > video').getAttribute('autoplay')).toBe('');
  await userEvent.selectOptions($<HTMLSelectElement>('#preset'), 'hls');
  expect($('#markup').textContent).toContain('preset="hls"');
  await userEvent.selectOptions($<HTMLSelectElement>('[data-look="subtitle-size"]'), 'large');
  expect(player().getAttribute('subtitle-size')).toBe('large');
  expect($('#markup').textContent).toContain('subtitle-size="large"');
});

it('the theme toggle switches rooms and remembers the choice', async () => {
  const first = await mount({ row: 'none' });
  const html = document.documentElement;
  // Headless browsers report a light system, so the button offers the dark room.
  expect(html.hasAttribute('data-theme')).toBe(false);
  expect(first.$('#theme-toggle').textContent).toMatch(/Dark/);
  await userEvent.click(first.$('#theme-toggle'));
  expect(html.getAttribute('data-theme')).toBe('dark');
  expect(first.$('#theme-toggle').textContent).toMatch(/Light/);
  const again = await first.remount();
  expect(html.getAttribute('data-theme')).toBe('dark');
  await userEvent.click(again.$('#theme-toggle'));
  expect(html.getAttribute('data-theme')).toBe('light');
});

it('the options are remembered across a reload', async () => {
  const first = await mount({ row: 'none' });
  await setChecked(first.$('[data-flag="autoplay"]'), true);
  await setChecked(first.$('#layout-right li[data-name="fullscreen"] input'), false);
  await userEvent.fill(first.$('[data-knob="skip-forward"]'), '15');
  await userEvent.selectOptions(first.$<HTMLSelectElement>('#language'), 'ca');
  const { $, $$, bar } = await first.remount();
  expect($<HTMLInputElement>('[data-flag="autoplay"]').checked).toBe(true);
  expect($<HTMLInputElement>('#layout-right li[data-name="fullscreen"] input').checked).toBe(false);
  expect($<HTMLInputElement>('[data-knob="skip-forward"]').value).toBe('15');
  expect($<HTMLSelectElement>('#language').value).toBe('ca');
  expect($$('mbx-skip-button', bar())[1]?.getAttribute('seconds')).toBe('15');
  expect($$('mbx-fullscreen-button', bar())).toHaveLength(0);

  // Reset forgets it all.
  await userEvent.click($('#reset-options'));
  expect($<HTMLInputElement>('[data-knob="skip-forward"]').value).toBe('10');
  expect($<HTMLInputElement>('#layout-right li[data-name="fullscreen"] input').checked).toBe(true);
  expect($<HTMLSelectElement>('#language').value).toBe('en');
  expect($$('mbx-fullscreen-button', bar())).toHaveLength(1);
});

it('the SRG SSR route is there, and idle until asked', async () => {
  const { $, $$ } = await mount({ row: 'none' });
  await userEvent.click($('#open-content'));
  await userEvent.click($('[data-route="srgssr"]'));
  expect(visible($('#route-srgssr'))).toBe(true);
  expect(visible($('#route-static'))).toBe(false);
  expect($$('#search-bu option')).toHaveLength(5);
  expect(visible($('#search-results'))).toBe(false);
});
