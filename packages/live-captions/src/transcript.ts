/**
 * The words on screen, from the recognizer's results. Pure: no DOM, no
 * timers.
 *
 * A recognition session returns its phrases as results: final ones, which
 * do not change again, and interim ones, which the recognizer rewrites as
 * it hears more. A session ends after a silence and the element starts
 * another, so the final words of earlier sessions are kept here.
 *
 * The words break into lines of a fixed number of words, counted from the
 * first word on screen, so a full line never changes again: the
 * recognizer's rewrites move the last line alone. The last lines show, and
 * older ones leave at the top as new ones start.
 */

/** One result of a recognition event: its best transcript, and whether it is final. */
export interface Phrase {
  readonly text: string;
  readonly final: boolean;
}

/** Words in a line by default. Short lines read at a glance, and a rewrite moves few words. */
export const LINE_WORDS = 5;
/** Lines on screen by default. */
export const LINES = 2;

export interface Transcript {
  /**
   * The results of the current session, in order, replacing its earlier
   * ones. Returns the phrases that became final with this update, for the
   * page's own transcript.
   */
  update(phrases: readonly Phrase[]): readonly string[];
  /** The session ended: its final words stay, its interim words go. */
  end(): void;
  /**
   * Drops every word, as after a seek, a new programme or a silence. The
   * current session's results so far stay dropped: the recognizer sends
   * them again with each new one.
   */
  clear(): void;
  /** What shows: the last lines, each its words joined by spaces. */
  lines(): readonly string[];
}

/** The words of `text`, without the spaces between them. */
function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter((word) => word !== '');
}

export function transcript(lineWords: number = LINE_WORDS, shown: number = LINES): Transcript {
  /** The final words of the sessions that ended, from the first word of a line on screen. */
  let done: string[] = [];
  /** The current session's results. */
  let current: readonly Phrase[] = [];
  /** How many of the current session's results were final at the last update. */
  let told = 0;
  /** How many of the current session's first results a clear dropped. */
  let skip = 0;

  return {
    update(phrases) {
      current = phrases.slice(skip);
      let finals = 0;
      while (finals < phrases.length && phrases[finals]?.final === true) finals += 1;
      const fresh = phrases
        .slice(told, finals)
        .map((phrase) => phrase.text.trim())
        .filter((text) => text !== '');
      told = Math.max(told, finals);
      return fresh;
    },
    end() {
      done = [...done, ...current.filter((p) => p.final).flatMap((p) => wordsOf(p.text))];
      // Whole lines leave, so the lines left keep their words.
      const keep = lineWords * shown;
      if (done.length > keep) {
        done = done.slice(Math.floor((done.length - keep) / lineWords) * lineWords);
      }
      current = [];
      told = 0;
      skip = 0;
    },
    clear() {
      done = [];
      skip += current.length;
      told = Math.max(told, skip);
      current = [];
    },
    lines() {
      const all = [...done, ...current.flatMap((phrase) => wordsOf(phrase.text))];
      const out: string[] = [];
      for (let i = 0; i < all.length; i += lineWords) {
        out.push(all.slice(i, i + lineWords).join(' '));
      }
      return out.slice(-shown);
    },
  };
}
