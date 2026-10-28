import { MatteboxPlayerElement } from '@mattebox/player';
import { nativeHandler } from '@mattebox/player-core';
import { afterEach, describe, expect, it } from 'vitest';
import de from '../../src/locales/de.js';
import { compose, fakeMedia } from './helpers.js';

function mount(controls: string): MatteboxPlayerElement {
  const player = new MatteboxPlayerElement({ handlers: [nativeHandler()] });
  fakeMedia(player.video);
  player.setAttribute('controls', controls);
  if (controls === 'custom') player.append(...compose());
  document.body.append(player);
  return player;
}

function part(root: Element | ShadowRoot | null | undefined, name: string): HTMLElement {
  const found = root?.querySelector<HTMLElement>(`[part~="${name}"]`);
  if (found == null) throw new Error(`no ${name}`);
  return found;
}

function screenOf(player: HTMLElement): HTMLElement {
  const screen = player.querySelector<HTMLElement>('mbx-error-screen');
  if (screen === null) throw new Error('no error screen');
  return screen;
}

const geo = {
  title: { en: 'Not available here', de: 'Hier nicht verfügbar' },
  message: { en: 'Only in Switzerland.', de: 'Nur in der Schweiz.' },
};

MatteboxPlayerElement.addLocale('de', de);

afterEach(() => {
  document.body.replaceChildren();
});

describe('a block', () => {
  it("shows its words on the error screen, without retry, in the player's language", () => {
    const player = mount('custom');
    const screen = screenOf(player);
    const changes: unknown[] = [];
    player.addEventListener('blockchange', (event) => changes.push(event.detail));
    player.block(geo);
    expect(player.blocked).toBe(geo);
    expect(changes).toEqual([geo]);
    expect(screen.hidden).toBe(false);
    expect(part(screen.shadowRoot, 'title').textContent).toBe('Not available here');
    expect(part(screen.shadowRoot, 'message').textContent).toBe('Only in Switzerland.');
    expect(part(screen.shadowRoot, 'retry').hidden).toBe(true);
    expect(part(screen.shadowRoot, 'detail').hidden).toBe(true);
    player.language = 'de-CH';
    expect(part(screen.shadowRoot, 'title').textContent).toBe('Hier nicht verfügbar');
    expect(part(screen.shadowRoot, 'message').textContent).toBe('Nur in der Schweiz.');
  });

  it("titles a block without a title with the player's word for not available", async () => {
    const player = mount('custom');
    const screen = screenOf(player);
    player.language = 'de';
    player.block({ message: 'Nur in der Schweiz.' });
    await expect.poll(() => part(screen.shadowRoot, 'title').textContent).toBe('Nicht verfügbar');
    expect(part(screen.shadowRoot, 'message').textContent).toBe('Nur in der Schweiz.');
  });

  it('shows a block that came before the screen did', () => {
    const player = mount('none');
    player.block(geo);
    const screen = document.createElement('mbx-error-screen');
    player.append(screen);
    expect(screen.hidden).toBe(false);
    expect(part(screen.shadowRoot, 'title').textContent).toBe('Not available here');
  });

  it('clears on unblock and on a new source', async () => {
    const player = mount('custom');
    const screen = screenOf(player);
    const changes: unknown[] = [];
    player.addEventListener('blockchange', (event) => changes.push(event.detail));
    player.block(geo);
    player.unblock();
    expect(player.blocked).toBeNull();
    await expect.poll(() => screen.hidden).toBe(true);
    player.block(geo);
    player.setAttribute('src', 'https://cdn.test/other.mp4');
    expect(player.blocked).toBeNull();
    await expect.poll(() => screen.hidden).toBe(true);
    player.block(geo);
    player.sources = [{ url: 'https://cdn.test/other.mp4', type: 'video/mp4' }];
    expect(player.blocked).toBeNull();
    expect(changes).toEqual([geo, null, geo, null, geo, null]);
  });

  it('leaves only the video and the error screen while a block or an error shows', async () => {
    const player = mount('custom');
    const bar = player.querySelector<HTMLElement>('mbx-control-bar');
    if (bar === null) throw new Error('no bar');
    player.block(geo);
    expect(player.hasAttribute('blocked')).toBe(true);
    expect(getComputedStyle(bar).display).toBe('none');
    expect(getComputedStyle(screenOf(player)).display).not.toBe('none');
    expect(getComputedStyle(player.video).display).not.toBe('none');
    player.unblock();
    expect(player.hasAttribute('blocked')).toBe(false);
    expect(getComputedStyle(bar).display).not.toBe('none');
    const fatal = { category: 'network', code: 'NETWORK_ERROR', fatal: true, recoverable: true };
    (player as unknown as { report(error: unknown): void }).report(fatal);
    expect(player.hasAttribute('error')).toBe(true);
    expect(getComputedStyle(bar).display).toBe('none');
    player.video.dispatchEvent(new Event('playing'));
    expect(player.hasAttribute('error')).toBe(false);
  });

  it('stops the video', () => {
    const player = mount('custom');
    player.video.play().catch(() => undefined);
    player.block(geo);
    expect(player.video.paused).toBe(true);
  });

  it('shows on the row under the video under native controls, and says it', async () => {
    const player = mount('');
    player.block(geo);
    const row = part(player.shadowRoot, 'error');
    expect(row.hidden).toBe(false);
    expect(row.textContent).toBe('Not available hereOnly in Switzerland.');
    expect(part(player.shadowRoot, 'error-retry').hidden).toBe(true);
    await expect
      .poll(() => part(player.shadowRoot, 'announcer').textContent)
      .toBe('Not available here. Only in Switzerland.');
    player.language = 'de';
    expect(row.textContent).toBe('Hier nicht verfügbarNur in der Schweiz.');
  });
});
