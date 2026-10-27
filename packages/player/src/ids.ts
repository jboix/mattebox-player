/**
 * Ids for trackers: a new one for each session, and one per device that
 * stays across visits. Built on `crypto.getRandomValues`, since
 * `crypto.randomUUID` is newer than the TVs the player runs on.
 */

/** A random UUID, version 4 (RFC 9562 §5.4). */
export function sessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // The version in the high nibble of byte 6, the variant in the two high bits of byte 8.
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface DeviceIdOptions {
  /** The storage key the id lives under. */
  readonly key: string;
  /** localStorage by default. */
  readonly storage?: Pick<Storage, 'getItem' | 'setItem'>;
}

/**
 * The id stored under `key`, or a new one stored there. A browser that
 * blocks storage gets a new id at each call.
 */
export function deviceId(options: DeviceIdOptions): string {
  let storage: Pick<Storage, 'getItem' | 'setItem'> | null = null;
  try {
    storage = options.storage ?? window.localStorage;
    const known = storage.getItem(options.key);
    if (known !== null && known !== '') return known;
  } catch {
    // Blocked: the id below lives for this call only.
  }
  const id = sessionId();
  try {
    storage?.setItem(options.key, id);
  } catch {
    // Full or blocked, as above.
  }
  return id;
}
