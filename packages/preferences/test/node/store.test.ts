import { describe, expect, it } from 'vitest';
import type { PreferenceStorage } from '../../src/store.js';
import { preferences } from '../../src/store.js';

/** A storage that keeps its entries in a map, as localStorage does. */
function memory(
  entries: Record<string, string> = {},
): PreferenceStorage & { entries: Record<string, string> } {
  return {
    entries,
    getItem: (key) => entries[key] ?? null,
    setItem: (key, value) => {
      entries[key] = value;
    },
  };
}

describe('the store', () => {
  it('is the same object for the same key', () => {
    expect(preferences({ key: 'same', storage: memory() })).toBe(preferences({ key: 'same' }));
    expect(preferences()).toBe(preferences());
    expect(preferences()).not.toBe(preferences({ key: 'same' }));
  });

  it('writes a versioned entry under its key, and reads it back', () => {
    const storage = memory();
    const store = preferences({ key: 'written', storage });
    store.set('volume', 0.5);
    store.set('subtitles', null);
    expect(JSON.parse(storage.entries.written as string)).toEqual({
      version: 1,
      values: { volume: 0.5, subtitles: null },
    });
    store.set('volume', undefined);
    expect(store.get('volume')).toBeUndefined();
    expect(store.get('subtitles')).toBeNull();
  });

  it('reads what an earlier visit wrote, and ignores another version or a broken entry', () => {
    const entry = (version: number) => JSON.stringify({ version, values: { rate: 1.5 } });
    expect(preferences({ key: 'v1', storage: memory({ v1: entry(1) }) }).get('rate')).toBe(1.5);
    expect(
      preferences({ key: 'v2', storage: memory({ v2: entry(2) }) }).get('rate'),
    ).toBeUndefined();
    expect(preferences({ key: 'bad', storage: memory({ bad: '{' }) }).get('rate')).toBeUndefined();
  });

  it('keeps a value in memory when the storage throws', () => {
    const store = preferences({
      key: 'full',
      storage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      },
    });
    store.set('muted', true);
    expect(store.get('muted')).toBe(true);
  });

  it('tells a listener of a change, once, until it stops', () => {
    const store = preferences({ key: 'told', storage: memory() });
    const heard: unknown[] = [];
    const off = store.on('rate', (value) => heard.push(value));
    store.set('rate', 2);
    store.set('rate', 2);
    off();
    store.set('rate', 1);
    expect(heard).toEqual([2]);
  });
});
