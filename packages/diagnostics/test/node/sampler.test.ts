/** The sampler over a fake video and a fake engine: the intake of the trace, both routes. */
import type { Mattebox } from 'mattebox';
import { describe, expect, it } from 'vitest';
import { createSampler } from '../../src/sampler.js';

function video(): HTMLVideoElement {
  return {
    currentTime: 1,
    paused: true,
    ended: false,
    seeking: false,
    readyState: 4,
    buffered: { length: 0, start: () => 0, end: () => 0 },
  } as unknown as HTMLVideoElement;
}

function ring(): unknown[] {
  return [
    {
      t: performance.now() - 100,
      msg: { type: 'SEGMENT_LOADED', trackId: 'video:main', seq: 1, size: 500_000, rtt: 200 },
      effects: [],
      digest: 'a',
    },
    {
      t: performance.now() - 50,
      msg: { type: 'STALLED', at: 2 },
      effects: [{ kind: 'emit', event: 'recovery:nudge', payload: {} }],
      digest: 'b',
    },
  ];
}

function engine(entries: unknown[]): Mattebox & { emit: (entry: unknown) => void } {
  const listeners = new Set<(entry: unknown) => void>();
  return {
    emit(entry: unknown): void {
      for (const fn of listeners) fn(entry);
    },
    on: (event: string, fn: (payload: unknown) => void) => {
      if (event === 'trace') listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    quality: { playing: null },
    stats: {
      trace: () => entries,
      snapshot: () => ({ stats: { throughputEwma: 0, throughputFastEwma: 0 } }),
    },
  } as unknown as Mattebox & { emit: (entry: unknown) => void };
}

describe('the sampler', () => {
  it('takes the ring once, through the cursor, and keeps a slimmed history', () => {
    const entries = ring();
    const sampler = createSampler();
    const fake = engine(entries);
    sampler.attach(video(), fake);
    sampler.poll(video(), fake);
    sampler.poll(video(), fake);
    expect(sampler.history.length).toBe(2);
    expect(sampler.marks.map((mark) => mark.kind)).toEqual(['segment', 'stall', 'nudge']);
    expect(sampler.samples.length).toBe(2);
  });

  it('takes an entry from the event, and not again from the ring', () => {
    const entries = ring();
    const sampler = createSampler();
    const fake = engine(entries);
    sampler.attach(video(), fake);
    fake.emit(entries[0]);
    sampler.poll(video(), fake);
    expect(sampler.history.length).toBe(2);
    expect(sampler.marks.map((mark) => mark.kind)).toEqual(['segment', 'stall', 'nudge']);
    sampler.attach(video(), null);
    expect(sampler.history.length).toBe(0);
  });
});
