import { describe, expect, it } from 'vitest';
import { transcript } from '../../src/transcript.js';

describe('transcript', () => {
  it('shows the final words, then the interim ones', () => {
    const words = transcript();
    words.update([
      { text: 'Good evening', final: true },
      { text: ' and welco', final: false },
    ]);
    expect(words.lines()).toEqual(['Good evening and welco']);
    words.update([
      { text: 'Good evening', final: true },
      { text: ' and welcome', final: false },
    ]);
    expect(words.lines()).toEqual(['Good evening and welcome']);
  });

  it('breaks the words into lines of five, and a full line stays as it is', () => {
    const words = transcript();
    words.update([{ text: 'one two three four five six', final: false }]);
    expect(words.lines()).toEqual(['one two three four five', 'six']);
    // A rewrite of the interim words moves the last line alone.
    words.update([{ text: 'one two three four five sixty seven', final: false }]);
    expect(words.lines()).toEqual(['one two three four five', 'sixty seven']);
  });

  it('rolls up: the last two lines show, older ones leave at the top', () => {
    const words = transcript();
    words.update([{ text: 'a b c d e f g h i j', final: true }]);
    words.end();
    words.update([{ text: 'k', final: false }]);
    expect(words.lines()).toEqual(['f g h i j', 'k']);
  });

  it('keeps whole lines when a session ends, so the lines on screen do not shift', () => {
    const words = transcript(3, 2);
    words.update([{ text: 'a b c d e f g', final: true }]);
    words.end();
    expect(words.lines()).toEqual(['d e f', 'g']);
    words.update([{ text: 'h i', final: false }]);
    expect(words.lines()).toEqual(['d e f', 'g h i']);
  });

  it('returns each phrase once, when it becomes final', () => {
    const words = transcript();
    expect(words.update([{ text: 'Good', final: false }])).toEqual([]);
    expect(words.update([{ text: 'Good evening', final: true }])).toEqual(['Good evening']);
    expect(
      words.update([
        { text: 'Good evening', final: true },
        { text: 'and', final: false },
      ]),
    ).toEqual([]);
    expect(
      words.update([
        { text: 'Good evening', final: true },
        { text: ' and welcome', final: true },
      ]),
    ).toEqual(['and welcome']);
  });

  it('keeps the final words of a session that ended, and drops its interim ones', () => {
    const words = transcript();
    words.update([
      { text: 'Good evening', final: true },
      { text: 'and', final: false },
    ]);
    words.end();
    expect(words.lines()).toEqual(['Good evening']);
    // The next session starts its own results, and returns its own finals.
    expect(words.update([{ text: 'and welcome', final: true }])).toEqual(['and welcome']);
    expect(words.lines()).toEqual(['Good evening and welcome']);
  });

  it('keeps a cleared session’s results gone when the recognizer sends them again', () => {
    const words = transcript();
    words.update([{ text: 'Good evening', final: true }]);
    words.clear();
    expect(words.lines()).toEqual([]);
    // After a silence, the same session's next result comes with all its earlier ones.
    expect(
      words.update([
        { text: 'Good evening', final: true },
        { text: 'and welcome', final: true },
      ]),
    ).toEqual(['and welcome']);
    expect(words.lines()).toEqual(['and welcome']);
    // The next session counts from zero again.
    words.end();
    words.update([{ text: 'Goodbye', final: false }]);
    expect(words.lines()).toEqual(['and welcome Goodbye']);
  });

  it('drops every word on clear', () => {
    const words = transcript();
    words.update([{ text: 'Good evening', final: true }]);
    words.end();
    words.clear();
    expect(words.lines()).toEqual([]);
    expect(words.update([{ text: 'Again', final: true }])).toEqual(['Again']);
  });
});
