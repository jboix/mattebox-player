import { describe, expect, it } from 'vitest';
import { clock, lineAt, plain, speaker, toLines, toRows } from '../../src/lines.js';

describe('the words of a cue', () => {
  it('leaves the tags out and reads the character references', () => {
    expect(plain('<i>By noon</i> the train is at the top.')).toBe(
      'By noon the train is at the top.',
    );
    expect(plain('<c.yellow.bg_blue>Tom &amp; Anna</c> &lt;3 &#233;t&#xe9;')).toBe(
      'Tom & Anna <3 été',
    );
    expect(plain('<00:00:01.000>One <00:00:02.000>two')).toBe('One two');
  });

  it('joins the lines of a cue with one space', () => {
    expect(plain('  The first line\nthe second&nbsp;line  ')).toBe(
      'The first line the second line',
    );
  });

  it('keeps a reference it does not know as written', () => {
    expect(plain('R&D; and &unknown;')).toBe('R&D; and &unknown;');
  });

  it('names the voice of a voice tag', () => {
    expect(speaker('<v Anna>Hello')).toBe('Anna');
    expect(speaker('<v.loud Tom Smith>Hello</v>')).toBe('Tom Smith');
    expect(speaker('Hello')).toBeUndefined();
  });
});

describe('the lines of a transcript', () => {
  it('is one line for each cue, by start, with the speaker apart from the words', () => {
    const lines = toLines([
      { start: 6, end: 9, text: 'It climbs for an hour.' },
      { start: 1, end: 4, text: '<v Anna>The first train leaves.' },
    ]);
    expect(lines).toEqual([
      { start: 1, end: 4, text: 'The first train leaves.', speaker: 'Anna' },
      { start: 6, end: 9, text: 'It climbs for an hour.' },
    ]);
  });

  it('is one line for a cue that two segments carry, and none for a cue without words', () => {
    const lines = toLines([
      { start: 18, end: 22, text: 'The crew clears the track.' },
      { start: 18, end: 22, text: 'The crew clears the track.' },
      { start: 30, end: 31, text: '<i> </i>' },
    ]);
    expect(lines.map((line) => line.start)).toEqual([18]);
  });

  it('finds the line that is spoken: the last one that started', () => {
    const lines = toLines([
      { start: 1, end: 4, text: 'One' },
      { start: 6, end: 9, text: 'Two' },
    ]);
    expect(lineAt(lines, 0.5)).toBeNull();
    expect(lineAt(lines, 1)?.text).toBe('One');
    // Between two cues the last one stays, as lyrics do.
    expect(lineAt(lines, 5)?.text).toBe('One');
    expect(lineAt(lines, 60)?.text).toBe('Two');
  });
});

describe('the rows of the list', () => {
  const lines = toLines([
    { start: 1, end: 4, text: 'One' },
    { start: 12, end: 15, text: 'Hidden' },
    { start: 22, end: 25, text: 'Three' },
  ]);

  it('shows a part that is not loaded as one row', () => {
    const rows = toRows(lines.slice(0, 1), [{ start: 0, end: 10 }], [], 40);
    expect(rows).toEqual([
      { kind: 'line', line: lines[0] },
      { kind: 'gap', span: { start: 10, end: 40 } },
    ]);
  });

  it('shows one row for a range that must not play, and none of its lines', () => {
    const rows = toRows(lines, [{ start: 0, end: 40 }], [{ start: 10, end: 20 }], 40);
    expect(rows.map((row) => row.kind)).toEqual(['line', 'blocked', 'line']);
    expect(JSON.stringify(rows)).not.toContain('Hidden');
  });

  it('shows no blocked row for a range the loaded parts do not reach', () => {
    const rows = toRows(lines.slice(0, 1), [{ start: 0, end: 5 }], [{ start: 10, end: 20 }], 40);
    expect(rows.map((row) => row.kind)).toEqual(['line', 'gap']);
  });

  it('asks for nothing where a blocked range covers the whole part', () => {
    const rows = toRows(
      [],
      [
        { start: 0, end: 10 },
        { start: 20, end: 40 },
      ],
      [{ start: 10, end: 20 }],
      40,
    );
    expect(rows.map((row) => row.kind)).toEqual(['blocked']);
  });
});

describe('a time of the list', () => {
  it('reads minutes and seconds, and hours from one up', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(75.9)).toBe('1:15');
    expect(clock(3723)).toBe('1:02:03');
    expect(clock(-3)).toBe('0:00');
  });
});
