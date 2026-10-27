/**
 * Words a page gives the player, such as why a programme is blocked: one
 * string, or the same words by language tag, which the player reads in
 * its own language and reads again on `localechange`.
 */

import type { Text } from '@mattebox/player-core';

export type { Text };

/**
 * The words of `text` for `locale`: the tag, then its language alone, so
 * `de-CH` falls back to `de` (BCP 47 lookup, RFC 4647 §3.4), then English,
 * then the first entry. Tags compare without case.
 */
export function textIn(text: Text, locale: string): string {
  if (typeof text === 'string') return text;
  const tags = new Map<string, string>();
  for (const tag of Object.keys(text)) tags.set(tag.toLowerCase(), text[tag] as string);
  const key = locale.toLowerCase();
  return (
    tags.get(key) ??
    tags.get(key.split('-')[0] as string) ??
    tags.get('en') ??
    tags.values().next().value ??
    ''
  );
}
