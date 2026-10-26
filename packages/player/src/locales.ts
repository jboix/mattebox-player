/**
 * The languages a page registered, shared by every player on it. A
 * language is a list of word sets, merged in order, so a page's own words
 * go over the shipped ones. A set can be a loader, which runs the first
 * time a player needs the language: a page registers every language it
 * offers and downloads only the one it shows.
 */
import type { Words } from './messages.js';

/** A set of words, or a function that loads one, such as `() => import('…/locales/de.js')`. */
export type LocaleSource = Words | (() => Promise<Words | { readonly default: Words }>);

/** By lowercase language tag. A loaded set takes its loader's place. */
const registry = new Map<string, LocaleSource[]>();
const listeners = new Set<() => void>();

export function addLocale(language: string, sources: readonly LocaleSource[]): void {
  const key = language.toLowerCase();
  registry.set(key, [...(registry.get(key) ?? []), ...sources]);
  for (const listener of listeners) listener();
}

/** Calls `fn` on every registration, until the returned function runs. */
export function onLocales(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * The registered key for a language tag: the tag, else its language
 * alone, so `de-CH` falls back to `de` (BCP 47 lookup, RFC 4647 §3.4).
 * Null when neither is registered, and English then comes from the
 * controls themselves.
 */
export function registered(tag: string): string | null {
  const key = tag.toLowerCase();
  if (registry.has(key)) return key;
  const base = key.split('-')[0] as string;
  return registry.has(base) ? base : null;
}

/** The merged words of `key` now, or null while a loader of it has not run. */
export function wordsNow(key: string): Words | null {
  const sources = registry.get(key) ?? [];
  if (sources.some((source) => typeof source === 'function')) return null;
  return Object.assign({}, ...(sources as Words[]));
}

/** Runs the loaders of `key` once, keeps what they load, and answers the merged words. */
export async function load(key: string): Promise<Words> {
  const sources = registry.get(key) ?? [];
  const loaded = await Promise.all(
    sources.map(async (source) => {
      if (typeof source !== 'function') return source;
      const module = await source();
      return 'default' in module ? (module.default as Words) : (module as Words);
    }),
  );
  // A registration while the loaders ran goes after them, as it was made.
  registry.set(key, [...loaded, ...(registry.get(key) ?? []).slice(sources.length)]);
  return wordsNow(key) ?? Object.assign({}, ...loaded);
}
