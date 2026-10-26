import { MatteboxPlayerElement } from '@mattebox/player';
import { nativeHandler } from '@mattebox/player-core';
import { afterEach, describe, expect, it } from 'vitest';
import de from '../../src/locales/de.js';
import { compose, fakeMedia } from './helpers.js';

/** A player under custom controls, with every control, over the native handler. */
function mount(attributes: Readonly<Record<string, string>> = {}): MatteboxPlayerElement {
  const player = new MatteboxPlayerElement({ handlers: [nativeHandler()] });
  fakeMedia(player.video);
  player.setAttribute('controls', 'custom');
  for (const [name, value] of Object.entries(attributes)) player.setAttribute(name, value);
  player.append(...compose());
  document.body.append(player);
  return player;
}

/** The name of the play button, where a screen reader reads it. */
function playName(player: HTMLElement): string | null {
  const control = player.querySelector('mbx-play-button');
  return control?.shadowRoot?.querySelector('button')?.getAttribute('aria-label') ?? null;
}

MatteboxPlayerElement.addLocale('de', de);

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.removeAttribute('lang');
});

describe('the languages', () => {
  it('follows language over lang, and switches live, back to English', async () => {
    document.documentElement.lang = 'fr';
    const player = mount();
    await expect.poll(() => playName(player)).toBe('Play');
    player.language = 'de-CH';
    expect(playName(player)).toBe('Wiedergabe');
    expect(player.locale).toBe('de-CH');
    player.language = '';
    expect(playName(player)).toBe('Play');
  });

  it('follows a change of the page lang', async () => {
    const player = mount();
    await expect.poll(() => playName(player)).toBe('Play');
    document.documentElement.lang = 'de';
    await expect.poll(() => playName(player)).toBe('Wiedergabe');
  });

  it('loads a language only when a player shows it, and keeps the attribute of a control', async () => {
    let loads = 0;
    MatteboxPlayerElement.addLocale('xx', () => {
      loads++;
      return Promise.resolve({ default: { play: 'Loaded', pause: 'Loaded pause' } });
    });
    const player = mount();
    await expect.poll(() => playName(player)).toBe('Play');
    expect(loads).toBe(0);
    player.querySelector('mbx-play-button')?.setAttribute('label-play', 'Mine');
    player.language = 'xx';
    await expect.poll(() => loads).toBe(1);
    expect(playName(player)).toBe('Mine');
    expect(player.message('play')).toBe('Loaded');
  });

  it('takes the words a page registers over a shipped language at once', async () => {
    const player = mount({ language: 'de' });
    await expect.poll(() => playName(player)).toBe('Wiedergabe');
    MatteboxPlayerElement.addLocale('de', { play: 'Abspielen' });
    expect(playName(player)).toBe('Abspielen');
  });
});
