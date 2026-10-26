/**
 * The languages the demo offers: the ones the packages ship. Each package
 * carries its own words, so a language is one loader per package, and the
 * player downloads a language only when it shows it.
 */
import type { LocaleSource } from '@mattebox/player';
import { MatteboxPlayerElement } from '@mattebox/player';

/** Each language's name in itself, for the select, by its tag. */
export const LANGUAGES: Readonly<Record<string, string>> = {
  ca: 'Català',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  hi: 'हिन्दी',
  ar: 'العربية',
};

/** The packages with words of their own, in the order a page imports them. */
export const WORD_PACKAGES = [
  '@mattebox/player',
  '@mattebox/player-playlist',
  '@mattebox/player-cast',
  '@mattebox/player-diagnostics',
] as const;

const LOADERS: Readonly<Record<string, readonly LocaleSource[]>> = {
  ca: [
    () => import('@mattebox/player/locales/ca'),
    () => import('@mattebox/player-playlist/locales/ca'),
    () => import('@mattebox/player-cast/locales/ca'),
    () => import('@mattebox/player-diagnostics/locales/ca'),
  ],
  es: [
    () => import('@mattebox/player/locales/es'),
    () => import('@mattebox/player-playlist/locales/es'),
    () => import('@mattebox/player-cast/locales/es'),
    () => import('@mattebox/player-diagnostics/locales/es'),
  ],
  fr: [
    () => import('@mattebox/player/locales/fr'),
    () => import('@mattebox/player-playlist/locales/fr'),
    () => import('@mattebox/player-cast/locales/fr'),
    () => import('@mattebox/player-diagnostics/locales/fr'),
  ],
  de: [
    () => import('@mattebox/player/locales/de'),
    () => import('@mattebox/player-playlist/locales/de'),
    () => import('@mattebox/player-cast/locales/de'),
    () => import('@mattebox/player-diagnostics/locales/de'),
  ],
  it: [
    () => import('@mattebox/player/locales/it'),
    () => import('@mattebox/player-playlist/locales/it'),
    () => import('@mattebox/player-cast/locales/it'),
    () => import('@mattebox/player-diagnostics/locales/it'),
  ],
  pt: [
    () => import('@mattebox/player/locales/pt'),
    () => import('@mattebox/player-playlist/locales/pt'),
    () => import('@mattebox/player-cast/locales/pt'),
    () => import('@mattebox/player-diagnostics/locales/pt'),
  ],
  zh: [
    () => import('@mattebox/player/locales/zh'),
    () => import('@mattebox/player-playlist/locales/zh'),
    () => import('@mattebox/player-cast/locales/zh'),
    () => import('@mattebox/player-diagnostics/locales/zh'),
  ],
  ja: [
    () => import('@mattebox/player/locales/ja'),
    () => import('@mattebox/player-playlist/locales/ja'),
    () => import('@mattebox/player-cast/locales/ja'),
    () => import('@mattebox/player-diagnostics/locales/ja'),
  ],
  ko: [
    () => import('@mattebox/player/locales/ko'),
    () => import('@mattebox/player-playlist/locales/ko'),
    () => import('@mattebox/player-cast/locales/ko'),
    () => import('@mattebox/player-diagnostics/locales/ko'),
  ],
  hi: [
    () => import('@mattebox/player/locales/hi'),
    () => import('@mattebox/player-playlist/locales/hi'),
    () => import('@mattebox/player-cast/locales/hi'),
    () => import('@mattebox/player-diagnostics/locales/hi'),
  ],
  ar: [
    () => import('@mattebox/player/locales/ar'),
    () => import('@mattebox/player-playlist/locales/ar'),
    () => import('@mattebox/player-cast/locales/ar'),
    () => import('@mattebox/player-diagnostics/locales/ar'),
  ],
};

/** Registers every language with every package's words. */
export function registerLanguages(): void {
  for (const [code, sources] of Object.entries(LOADERS)) {
    MatteboxPlayerElement.addLocale(code, ...sources);
  }
}
