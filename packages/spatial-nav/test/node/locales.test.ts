/**
 * The controls bubble's words in the 11 languages: every language gives
 * every id, and no word is empty.
 */
import { describe, expect, it } from 'vitest';
import ar from '../../src/locales/ar.js';
import ca from '../../src/locales/ca.js';
import de from '../../src/locales/de.js';
import es from '../../src/locales/es.js';
import fr from '../../src/locales/fr.js';
import hi from '../../src/locales/hi.js';
import it_ from '../../src/locales/it.js';
import ja from '../../src/locales/ja.js';
import ko from '../../src/locales/ko.js';
import pt from '../../src/locales/pt.js';
import zh from '../../src/locales/zh.js';
import type { GamepadMessages } from '../../src/messages.js';

const LANGUAGES: Readonly<Record<string, GamepadMessages>> = {
  ar,
  ca,
  de,
  es,
  fr,
  hi,
  it: it_,
  ja,
  ko,
  pt,
  zh,
};

/** Every id, which the compiler holds to the type: a missing one fails to compile. */
const IDS = Object.keys({
  gamepadController: true,
  gamepadMove: true,
  gamepadSelect: true,
  gamepadBack: true,
  gamepadPlayPause: true,
  gamepadRewind: true,
  gamepadFastForward: true,
  gamepadPrevious: true,
  gamepadNext: true,
  gamepadSubtitles: true,
  gamepadMute: true,
  gamepadFullscreen: true,
  gamepadControls: true,
  gamepadCross: true,
  gamepadCircle: true,
  gamepadSquare: true,
  gamepadTriangle: true,
} satisfies Record<keyof GamepadMessages, true>).sort();

describe('the languages of the controls bubble', () => {
  it('ships 11 languages', () => {
    expect(Object.keys(LANGUAGES)).toHaveLength(11);
  });

  for (const [language, words] of Object.entries(LANGUAGES)) {
    it(`gives every id a word in ${language}`, () => {
      expect(Object.keys(words).sort()).toEqual(IDS);
      for (const word of Object.values(words)) expect(word.trim()).not.toBe('');
    });
  }
});
