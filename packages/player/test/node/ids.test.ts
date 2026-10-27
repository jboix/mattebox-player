import { describe, expect, it } from 'vitest';
import { deviceId, sessionId } from '../../src/ids.js';

/** A storage in memory, with the two methods the helper uses. */
function memory(): Pick<Storage, 'getItem' | 'setItem'> & { readonly map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe('sessionId', () => {
  it('is a version 4 UUID, new at each call', () => {
    const a = sessionId();
    const b = sessionId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});

describe('deviceId', () => {
  it('stores a new id under the key, and returns it at the next call', () => {
    const storage = memory();
    const first = deviceId({ key: 'app.device', storage });
    expect(storage.map.get('app.device')).toBe(first);
    expect(deviceId({ key: 'app.device', storage })).toBe(first);
  });

  it('gives a fresh id when the storage throws', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(deviceId({ key: 'app.device', storage })).toMatch(/^[0-9a-f-]{36}$/);
  });
});
