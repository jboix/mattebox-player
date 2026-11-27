import { describe, expect, it } from 'vitest';
import type { Cue, Span } from '../../src/lines.js';
import { createLoader, merge, missing, WINDOW } from '../../src/loader.js';

/** A read that records each range, and answers one cue at its start. */
function rig(length: number, fail: (range: Span) => boolean = () => false) {
  const asked: Span[] = [];
  let changes = 0;
  const loader = createLoader(
    async (range) => {
      asked.push({ start: range.start, end: range.end });
      await Promise.resolve();
      if (fail(range)) throw new Error('HTTP 503');
      return [{ start: range.start, end: range.start + 1, text: `at ${range.start}` }] as Cue[];
    },
    length,
    () => {
      changes += 1;
    },
  );
  return { loader, asked, changes: () => changes };
}

describe('the parts of a transcript', () => {
  it('merges the parts that touch', () => {
    expect(
      merge([
        { start: 30, end: 40 },
        { start: 0, end: 10 },
        { start: 10, end: 20 },
      ]),
    ).toEqual([
      { start: 0, end: 20 },
      { start: 30, end: 40 },
    ]);
  });

  it('names what of a range is not loaded', () => {
    const loaded = [
      { start: 10, end: 20 },
      { start: 30, end: 40 },
    ];
    expect(missing({ start: 0, end: 50 }, loaded)).toEqual([
      { start: 0, end: 10 },
      { start: 20, end: 30 },
      { start: 40, end: 50 },
    ]);
    expect(missing({ start: 12, end: 18 }, loaded)).toEqual([]);
  });
});

describe('the loader of a transcript', () => {
  it('loads the part around a moment, inside the programme', async () => {
    const { loader, asked } = rig(1000);
    await loader.around(30);
    expect(asked).toEqual([{ start: 0, end: 30 + WINDOW }]);
    expect(loader.loaded).toEqual([{ start: 0, end: 30 + WINDOW }]);
    expect(loader.cues).toHaveLength(1);
  });

  it('asks for each part once', async () => {
    const { loader, asked } = rig(1000);
    await loader.around(500);
    await loader.around(520);
    expect(asked).toEqual([
      { start: 500 - WINDOW, end: 500 + WINDOW },
      { start: 500 + WINDOW, end: 520 + WINDOW },
    ]);
  });

  it('does not ask twice for a part that is under way', async () => {
    const { loader, asked } = rig(1000);
    const first = loader.around(500);
    const second = loader.around(500);
    expect(loader.pending).toBe(1);
    await Promise.all([first, second]);
    expect(asked).toHaveLength(1);
    expect(loader.pending).toBe(0);
  });

  it('loads one step of a part from the side the viewer came from', async () => {
    const { loader, asked } = rig(1000);
    await loader.into({ start: 200, end: 800 }, 'start');
    await loader.into({ start: 200 + WINDOW, end: 800 }, 'end');
    expect(asked).toEqual([
      { start: 200, end: 200 + WINDOW },
      { start: 800 - WINDOW, end: 800 },
    ]);
  });

  it('loads everything, the part nearest the playhead first', async () => {
    const { loader, asked } = rig(600);
    await loader.all(500);
    expect(asked[0]).toEqual({ start: 360, end: 540 });
    expect(loader.loaded).toEqual([{ start: 0, end: 600 }]);
  });

  it('reads as busy from the first step of everything to the last', async () => {
    const { loader, changes } = rig(600);
    const pending = loader.all(0);
    expect(loader.pending).toBeGreaterThan(0);
    await pending;
    expect(loader.pending).toBe(0);
    // One change for each of the four steps, and one when all of it is there.
    expect(changes()).toBe(5);
  });

  it('stops loading everything at a step that fails', async () => {
    const { loader, asked } = rig(600, (range) => range.start === 180);
    await loader.all(0);
    expect(asked).toEqual([
      { start: 0, end: 180 },
      { start: 180, end: 360 },
    ]);
    expect(loader.failed).toBe(true);
    expect(loader.pending).toBe(0);
  });

  it('says a part failed, and asks for it again at the next call', async () => {
    let failing = true;
    const { loader, asked, changes } = rig(1000, () => failing);
    await loader.around(500);
    expect(loader.failed).toBe(true);
    expect(loader.loaded).toEqual([]);
    expect(changes()).toBe(1);
    failing = false;
    await loader.around(500);
    expect(loader.failed).toBe(false);
    expect(asked).toHaveLength(2);
    expect(loader.loaded).toEqual([{ start: 500 - WINDOW, end: 500 + WINDOW }]);
  });

  it('takes nothing after it stops', async () => {
    const { loader, changes } = rig(1000);
    const pending = loader.around(500);
    loader.stop();
    await pending;
    expect(loader.cues).toEqual([]);
    expect(changes()).toBe(0);
    await loader.around(100);
    expect(loader.loaded).toEqual([]);
  });
});
