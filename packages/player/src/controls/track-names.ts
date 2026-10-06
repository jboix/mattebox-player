/**
 * The words the audio and subtitles menus show for a track, for an engine
 * session and a native one alike. Pure, node-tested.
 */
import type { MenuGroup } from './menu.js';

/**
 * One menu entry: its value, the stream's name for it, its language code,
 * its badges, and the hints that tell it from a twin, in the order they
 * are tried.
 */
export type TrackEntry = readonly [
  value: string,
  name: string | undefined,
  lang: string | undefined,
  badges: readonly string[],
  hints: ReadonlyArray<string | undefined>,
];

/**
 * The language's name in `locale`, with a capital first letter as the
 * browsers' own menus show it: French gives "anglais", the menu shows
 * "Anglais". Undefined without `Intl.DisplayNames` (Chromium 81, so not on
 * Tizen 6 or webOS 6), for a code it does not know, and for a locale or a
 * code it rejects.
 */
export function languageName(lang: string, locale?: string): string | undefined {
  try {
    // lib.dom types `Intl.DisplayNames` as always present.
    const name = new (Intl as { DisplayNames: typeof Intl.DisplayNames }).DisplayNames(locale, {
      type: 'language',
      fallback: 'none',
    }).of(lang) as string;
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return undefined;
  }
}

const LAYOUTS: Readonly<Record<string, string>> = { 1: 'Mono', 2: 'Stereo', 6: '5.1', 8: '7.1' };

/**
 * The audio layout of an HLS CHANNELS value (RFC 8216bis §4.4.6.1): "2"
 * reads Stereo, "6" reads 5.1, a "/JOC" suffix reads Dolby Atmos. Any
 * other count reads as written.
 */
export function layout(channels: string | undefined): string | undefined {
  return channels && (/\/JOC$/.test(channels) ? 'Dolby Atmos' : LAYOUTS[channels] || channels);
}

/**
 * The entries as menu items. Each reads as its name, else its language's
 * name, else its language code, else `word` ("Track") and its place. An
 * entry that would read like another, badges included, takes in
 * parentheses its first hint that differs from the other's, and at last
 * its place.
 */
export function trackNames(
  entries: readonly TrackEntry[],
  word: string | null,
  locale: string = document.documentElement.lang || navigator.language,
): MenuGroup['items'] {
  let texts = entries.map(
    ([, name, lang], index) =>
      name || (lang && (languageName(lang, locale) || lang)) || `${word || 'Track'} ${index + 1}`,
  );
  // Two rounds of hints at most (the audio menu's layout and role), then the place.
  for (let round = 0; round < 3; round++) {
    const keys = texts.map((text, index) => text + (entries[index] as TrackEntry)[3]);
    const hint = (index: number): string | undefined =>
      round < 2 ? (entries[index] as TrackEntry)[4][round] : String(index + 1);
    // A hint the twins share tells nothing apart, so the next round tries another.
    texts = texts.map((text, index) =>
      hint(index) &&
      keys.some(
        (key, other) => other !== index && key === keys[index] && hint(other) !== hint(index),
      )
        ? `${text} (${hint(index)})`
        : text,
    );
  }
  return entries.map(([value, , , badges], index) => [
    value,
    texts[index] as string,
    undefined,
    undefined,
    badges,
  ]);
}
