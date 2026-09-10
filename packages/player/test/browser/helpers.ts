/**
 * A valid WAV, so a native session in a hermetic test reaches `loadedmetadata`
 * instead of a MediaError. 8-bit mono at 8 kHz, an eighth of a second of
 * silence by default, the smallest file a browser will actually decode;
 * longer where a test seeks.
 */
export function silence(seconds = 0.125): string {
  const samples = Math.round(seconds * 8000);
  const bytes = new Uint8Array(44 + samples).fill(128, 44);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  ascii(36, 'data');
  view.setUint32(40, samples, true);
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
}

/** Resolves on the next `name` event from `target`. */
export function once(target: EventTarget, name: string): Promise<Event> {
  return new Promise((resolve) => {
    target.addEventListener(name, resolve, { once: true });
  });
}

/**
 * What a test moves on a deterministic video. Every move fires the events a
 * real video fires for it, on the next microtask, the way a real element
 * fires after the call that caused them; each resolves once they have fired.
 */
export interface FakeMedia {
  /** The metadata of a clip `seconds` long arrives, buffered whole: `durationchange`, `loadedmetadata`, `progress`. */
  metadata(seconds: number): Promise<void>;
  /** The browser has buffered from zero to `end`: `progress`. */
  buffer(end: number): Promise<void>;
  /** Playback reaches the end: `timeupdate`, `pause`, `ended`. */
  end(): Promise<void>;
}

const fakes = new WeakMap<HTMLVideoElement, FakeMedia>();

/** A `TimeRanges` over `list`. */
function ranges(list: ReadonlyArray<readonly [number, number]>): TimeRanges {
  const pick = (index: number): readonly [number, number] => {
    const range = list[index];
    if (range === undefined) throw new RangeError(`no range ${index}`);
    return range;
  };
  return {
    length: list.length,
    start: (index: number) => pick(index)[0],
    end: (index: number) => pick(index)[1],
  };
}

/**
 * Makes `video` deterministic: the playback state a control reads,
 * `paused`, `ended`, `currentTime`, `duration`, `readyState`, `buffered`
 * and `seekable`, is held on the instance and moved by the test or by
 * `play()`, `pause()` and a seek, with the events a real video fires for
 * each move and no media pipeline underneath. `muted`, `volume`,
 * `playbackRate` and the text tracks stay the element's own: without a
 * source they are plain state, and the browser fires their events the same
 * way. Nothing here ends or advances on its own.
 *
 * The browser's own pipeline is media.test.ts's, over a real WAV.
 */
export function fakeMedia(video: HTMLVideoElement): FakeMedia {
  const held = fakes.get(video);
  if (held !== undefined) return held;

  const state = {
    paused: true,
    time: 0,
    duration: Number.NaN,
    buffered: [] as Array<readonly [number, number]>,
  };
  const loaded = (): boolean => Number.isFinite(state.duration) && state.duration > 0;
  const ended = (): boolean => loaded() && state.time >= state.duration;

  function fire(names: readonly string[]): Promise<void> {
    return new Promise((resolve) => {
      queueMicrotask(() => {
        for (const name of names) video.dispatchEvent(new Event(name));
        resolve();
      });
    });
  }

  function seek(value: number): void {
    // Before the metadata a real video only remembers where to start.
    if (!loaded()) {
      state.time = Math.max(0, value);
      return;
    }
    state.time = Math.min(state.duration, Math.max(0, value));
    void fire(['seeking', 'timeupdate', 'seeked']);
  }

  async function play(): Promise<void> {
    const names: string[] = [];
    if (ended()) {
      state.time = 0;
      names.push('seeking', 'timeupdate', 'seeked');
    }
    if (state.paused) {
      state.paused = false;
      names.push('play', 'playing');
    }
    await fire(names);
  }

  function pause(): void {
    if (state.paused) return;
    state.paused = true;
    void fire(['timeupdate', 'pause']);
  }

  const define = (name: string, descriptor: PropertyDescriptor): void => {
    Object.defineProperty(video, name, { configurable: true, ...descriptor });
  };
  define('paused', { get: () => state.paused });
  define('ended', { get: ended });
  define('duration', { get: () => state.duration });
  define('readyState', { get: () => (loaded() ? HTMLMediaElement.HAVE_ENOUGH_DATA : 0) });
  define('buffered', { get: () => ranges(state.buffered) });
  define('seekable', { get: () => ranges(loaded() ? [[0, state.duration]] : []) });
  define('currentTime', { get: () => state.time, set: seek });
  define('play', { value: play });
  define('pause', { value: pause });

  const fake: FakeMedia = {
    metadata(seconds: number): Promise<void> {
      state.duration = seconds;
      state.buffered = [[0, seconds]];
      return fire(['durationchange', 'loadedmetadata', 'progress']);
    },
    buffer(end: number): Promise<void> {
      state.buffered = [[0, end]];
      return fire(['progress']);
    },
    end(): Promise<void> {
      state.time = state.duration;
      state.paused = true;
      return fire(['timeupdate', 'pause', 'ended']);
    },
  };
  fakes.set(video, fake);
  return fake;
}

/** The fake under `video`, which `fakeMedia` made. */
export function media(video: HTMLVideoElement): FakeMedia {
  const fake = fakes.get(video);
  if (fake === undefined) throw new Error('not a fake video');
  return fake;
}
