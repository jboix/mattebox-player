/**
 * The search of a transcript. Pure: no DOM, no timers.
 *
 * The panel's own search looks for the text in the lines it holds, without
 * regard to case or accents. A page can give a search of its own in its
 * place, such as a call to a search engine: it answers with the same
 * matches, and the panel then never loads the whole transcript.
 */
import type { Line } from './lines.js';

/** One place a search found. */
export interface TranscriptMatch {
  /** Programme seconds: where the line starts. */
  readonly time: number;
  /** The line's words, when the search has them. */
  readonly text?: string;
}

/** What a page's own search receives beside the text. */
export interface SearchContext {
  /** The language of the transcript shown, as the track states it, or empty. */
  readonly language: string;
  /** Aborted when the viewer types on, picks another language or closes the panel. */
  readonly signal: AbortSignal;
  /**
   * The panel's own search of the same text: it loads every line, then
   * looks in them. For a search that falls back to it when its server fails.
   */
  local(): Promise<readonly TranscriptMatch[]>;
}

/**
 * A page's own search: the matches of `query`, in any order. A rejection
 * shows the viewer that search is not available.
 */
export type TranscriptSearch = (
  query: string,
  context: SearchContext,
) => Promise<readonly TranscriptMatch[]>;

/** `text` without case or accents, each character still one character where Unicode allows. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Where `query` occurs in `text`, as `[from, to)` offsets into `text`.
 * Accents are removed before the comparison, and an offset counts the
 * characters of `text` itself, so a caller can cut `text` with it.
 */
export function occurrences(text: string, query: string): Array<readonly [number, number]> {
  const needle = fold(query.trim());
  if (needle === '') return [];
  // The folded text, with the offset in `text` each of its characters came from.
  let folded = '';
  const origin: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const piece = fold(text.charAt(index));
    for (let i = 0; i < piece.length; i += 1) origin.push(index);
    folded += piece;
  }
  const found: Array<readonly [number, number]> = [];
  let at = folded.indexOf(needle);
  while (at !== -1) {
    const from = origin[at] as number;
    let to = (origin[at + needle.length - 1] as number) + 1;
    // An accent written as a character of its own belongs to the letter before it.
    while (to < text.length && fold(text.charAt(to)) === '') to += 1;
    found.push([from, to]);
    at = folded.indexOf(needle, at + needle.length);
  }
  return found;
}

/** The lines that hold `query`, by time. */
export function searchLines(lines: readonly Line[], query: string): TranscriptMatch[] {
  if (fold(query.trim()) === '') return [];
  return lines
    .filter((line) => occurrences(line.text, query).length > 0)
    .map((line) => ({ time: line.start, text: line.text }));
}

/** The match to start from: the first at or after `time`, else the first. -1 without matches. */
export function nearest(matches: readonly TranscriptMatch[], time: number): number {
  if (matches.length === 0) return -1;
  const at = matches.findIndex((match) => match.time >= time);
  return at === -1 ? 0 : at;
}
