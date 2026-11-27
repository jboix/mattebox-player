/**
 * The lines of a transcript, from the cues of a text track. Pure: no DOM,
 * no timers.
 *
 * One line for each cue. A cue's text carries its format's markup, WebVTT
 * tags and character references; a line carries the words alone, and the
 * speaker where a voice tag names one. A cue the engine read twice, in two
 * segments, is one line.
 *
 * A range that must not play shows no line: its cues are dropped here, so
 * their text never reaches the page, and one row stands for the range.
 */

/** A cue as the engine's transcript stage gives it. */
export interface Cue {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** A range of the programme, in seconds. */
export interface Span {
  readonly start: number;
  readonly end: number;
}

/** One line of the transcript. */
export interface Line {
  /** Programme seconds: a press on the line seeks here. */
  readonly start: number;
  readonly end: number;
  /** The words, without markup. Lines of a cue are joined by a space. */
  readonly text: string;
  /** Who speaks, where the cue names a voice. */
  readonly speaker?: string;
}

/** A row of the list: a line, or a range whose lines are hidden. */
export type Row =
  | { readonly kind: 'line'; readonly line: Line }
  | { readonly kind: 'blocked'; readonly span: Span }
  /** A part of the programme whose lines are not loaded yet. */
  | { readonly kind: 'gap'; readonly span: Span };

const REFERENCES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  nbsp: ' ',
  lrm: '',
  rlm: '',
  quot: '"',
  apos: "'",
};

/** The words of a cue's text: tags removed, character references read, white space folded. */
export function plain(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
      const lower = name.toLowerCase();
      if (lower.startsWith('#x')) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
      if (lower.startsWith('#')) return String.fromCodePoint(Number(lower.slice(1)));
      return REFERENCES[lower] ?? whole;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** The voice a cue names first, `<v Anna>` or `<v.loud Anna>`, or undefined. */
export function speaker(text: string): string | undefined {
  const name = /<v(?:\.[^\s>]*)?\s+([^>]+)>/.exec(text)?.[1]?.trim();
  return name === undefined || name === '' ? undefined : plain(name);
}

/** The lines of `cues`, by start, each once. A cue with no words is no line. */
export function toLines(cues: readonly Cue[]): Line[] {
  const seen = new Set<string>();
  const lines: Line[] = [];
  for (const cue of cues) {
    const text = plain(cue.text);
    if (text === '') continue;
    const key = `${cue.start}|${cue.end}|${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const voice = speaker(cue.text);
    lines.push({
      start: cue.start,
      end: cue.end,
      text,
      ...(voice === undefined ? {} : { speaker: voice }),
    });
  }
  return lines.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Whether `time` is inside one of `spans`. */
export function within(time: number, spans: readonly Span[]): boolean {
  return spans.some((span) => span.start <= time && time < span.end);
}

/**
 * The rows of the list: the lines outside the blocked ranges, one row for
 * each blocked range that a loaded part touches, and one for each part of
 * `[0, length)` that is not loaded. `loaded` is sorted and does not overlap.
 */
export function toRows(
  lines: readonly Line[],
  loaded: readonly Span[],
  blocked: readonly Span[],
  length: number,
): Row[] {
  const rows: Array<Row & { readonly at: number }> = [];
  for (const line of lines) {
    if (!within(line.start, blocked)) rows.push({ kind: 'line', line, at: line.start });
  }
  for (const span of blocked) {
    if (loaded.some((part) => part.start <= span.end && span.start <= part.end)) {
      rows.push({ kind: 'blocked', span, at: span.start });
    }
  }
  let from = 0;
  for (const part of loaded) {
    if (part.start > from)
      rows.push({ kind: 'gap', span: { start: from, end: part.start }, at: from });
    from = Math.max(from, part.end);
  }
  if (from < length) rows.push({ kind: 'gap', span: { start: from, end: length }, at: from });
  // A gap that a blocked range covers whole has nothing to load.
  const shown = rows.filter(
    (row) =>
      row.kind !== 'gap' ||
      !blocked.some((span) => span.start <= row.span.start && row.span.end <= span.end),
  );
  const order = { blocked: 0, gap: 1, line: 2 };
  return shown
    .sort((a, b) => a.at - b.at || order[a.kind] - order[b.kind])
    .map(({ at: _, ...row }) => row as Row);
}

/** The line that is spoken at `time`: the last one that started. Null before the first. */
export function lineAt(lines: readonly Line[], time: number): Line | null {
  let found: Line | null = null;
  for (const line of lines) {
    if (line.start > time) break;
    found = line;
  }
  return found;
}

/** `m:ss`, or `h:mm:ss` from an hour up. */
export function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const pad = (value: number): string => (value < 10 ? `0${value}` : `${value}`);
  const rest = `${hours > 0 ? pad(minutes) : minutes}:${pad(total % 60)}`;
  return hours > 0 ? `${hours}:${rest}` : rest;
}
