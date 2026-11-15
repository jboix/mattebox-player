/**
 * The language tag to ask the recognizer for, from the tag a stream or a
 * page gives. Pure: no DOM.
 *
 * A stream labels its audio as it likes: `de`, `deu` or `ger` (ISO 639-2),
 * `de_CH`. The recognizer takes BCP 47 tags, which use the two-letter code
 * where one exists. `Intl.getCanonicalLocales` maps each to that form, from
 * the browser's own language data.
 */

/** Tags that name no language: undetermined, no linguistic content, several, missing. */
const NONE = new Set(['und', 'zxx', 'mul', 'mis']);

/** `tag` as a canonical BCP 47 tag, or '' when it names no language or is not a tag. */
export function normalize(tag: string | null | undefined): string {
  const text = (tag ?? '').trim().replace(/_/g, '-');
  if (text === '') return '';
  let canonical: string;
  try {
    canonical = Intl.getCanonicalLocales(text)[0] ?? '';
  } catch {
    return '';
  }
  return NONE.has(canonical.split('-')[0] ?? '') ? '' : canonical;
}
