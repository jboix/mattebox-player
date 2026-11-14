/**
 * `player.media`: the one object a control reads and calls for playback.
 * It is a `Proxy` over the `<video>`, and it behaves as the video until a
 * device plays in its place. Then the members the device answers are read
 * from the device, and every other member stays the video's: fullscreen,
 * the text tracks, the size.
 *
 * The video itself is untouched. Nothing is shadowed on it and no event is
 * dispatched on it for the device, because the engine listens there and a
 * made-up `play` or `seeking` would reach it.
 */
import type { RemoteMedia } from './remote.js';

/** The events a device reports in the video's place. */
const PLAYBACK: ReadonlySet<string> = new Set([
  'play',
  'pause',
  'playing',
  'waiting',
  'timeupdate',
  'seeking',
  'seeked',
  'durationchange',
  'ended',
  'volumechange',
  'ratechange',
]);

/** Called after a move, so a control draws the new state without knowing of the device. */
const REDRAW = ['durationchange', 'timeupdate', 'volumechange'];

type Listener = EventListenerOrEventListenerObject;
type Options = boolean | AddEventListenerOptions | undefined;

interface Heard {
  readonly type: string;
  readonly listener: Listener;
  readonly capture: boolean;
  readonly options: Options;
  /** What was given to the target: the listener, or its wrapper for `once`. */
  readonly given: Listener;
}

export interface Media {
  /** The proxy: one object for the life of the player. */
  readonly media: HTMLVideoElement;
  /** Reads the playback members from `remote`, and moves the playback listeners to it. */
  attach(remote: RemoteMedia): void;
  /** Back to the video. */
  detach(): void;
}

function captureOf(options: Options): boolean {
  return typeof options === 'boolean' ? options : options?.capture === true;
}

function call(listener: Listener, target: EventTarget, event: Event): void {
  if (typeof listener === 'function') listener.call(target, event);
  else listener.handleEvent(event);
}

/** Whether `name` is a method of the video: a function its prototype chain holds as a value. */
function isMethod(video: HTMLVideoElement, name: PropertyKey): boolean {
  let holder: object | null = Object.getPrototypeOf(video);
  while (holder !== null) {
    const found = Object.getOwnPropertyDescriptor(holder, name);
    if (found !== undefined) return typeof found.value === 'function';
    holder = Object.getPrototypeOf(holder);
  }
  return false;
}

export function createMedia(video: HTMLVideoElement): Media {
  let remote: RemoteMedia | null = null;
  const heard: Heard[] = [];
  /**
   * The video's methods, bound to it: a DOM method refuses any other
   * receiver. False for a name that is no method, asked once per name.
   */
  const bound = new Map<PropertyKey, { of: unknown; fn: unknown } | false>();

  /** Whether the device answers `name`. What every event target has stays the video's. */
  const remotely = (name: PropertyKey): boolean =>
    remote !== null &&
    typeof name === 'string' &&
    name in remote &&
    !(name in EventTarget.prototype);

  const targetOf = (type: string): EventTarget =>
    remote !== null && PLAYBACK.has(type) ? remote : video;

  const at = (type: string, listener: Listener, capture: boolean): number =>
    heard.findIndex(
      (entry) => entry.type === type && entry.listener === listener && entry.capture === capture,
    );

  function add(type: string, listener: Listener | null, options?: Options): void {
    if (listener === null || listener === undefined) return;
    const capture = captureOf(options);
    // The DOM takes a listener once per type and phase.
    if (at(type, listener, capture) !== -1) return;
    let given = listener;
    if (typeof options === 'object' && options.once === true) {
      given = (event: Event): void => {
        const index = at(type, listener, capture);
        if (index !== -1) heard.splice(index, 1);
        call(listener, event.currentTarget ?? video, event);
      };
    }
    heard.push({ type, listener, capture, options, given });
    targetOf(type).addEventListener(type, given, options);
  }

  function remove(type: string, listener: Listener | null, options?: Options): void {
    if (listener === null || listener === undefined) return;
    const index = at(type, listener, captureOf(options));
    if (index === -1) return;
    const [entry] = heard.splice(index, 1) as [Heard];
    targetOf(type).removeEventListener(type, entry.given, options);
  }

  /** Moves the playback listeners from one target to the other, then has them draw its state. */
  function move(from: EventTarget, to: EventTarget, paused: boolean): void {
    const moved = heard.filter((entry) => PLAYBACK.has(entry.type));
    for (const entry of moved) {
      from.removeEventListener(entry.type, entry.given, entry.options);
      to.addEventListener(entry.type, entry.given, entry.options);
    }
    const types = [...REDRAW, paused ? 'pause' : 'play'];
    for (const type of types) {
      for (const entry of moved) {
        // A `once` listener that ran during the loop has left the list.
        if (entry.type === type && heard.includes(entry)) call(entry.given, to, new Event(type));
      }
    }
  }

  const media = new Proxy(video, {
    get(target, name) {
      if (name === 'addEventListener') return add;
      if (name === 'removeEventListener') return remove;
      if (remotely(name)) {
        const source = remote as unknown as Record<PropertyKey, unknown>;
        const value = source[name];
        return typeof value === 'function' ? value.bind(remote) : value;
      }
      // The receiver is the video: a DOM getter refuses the proxy.
      const value: unknown = Reflect.get(target, name, target);
      if (typeof value !== 'function') return value;
      let held = bound.get(name);
      if (held === undefined) {
        held = isMethod(target, name) && { of: null, fn: null };
        bound.set(name, held);
      }
      // An event handler property, or a function the page put on the video, is returned as it is.
      if (held === false || Object.getOwnPropertyDescriptor(target, name) !== undefined) {
        return value;
      }
      if (held.of !== value) {
        held.of = value;
        held.fn = (value as (...args: unknown[]) => unknown).bind(target);
      }
      return held.fn;
    },
    set(target, name, value) {
      if (remotely(name)) {
        (remote as unknown as Record<PropertyKey, unknown>)[name] = value;
        return true;
      }
      return Reflect.set(target, name, value, target);
    },
  });

  return {
    media,
    attach(next) {
      const from: EventTarget = remote ?? video;
      remote = next;
      move(from, next, next.paused);
    },
    detach() {
      if (remote === null) return;
      const from = remote;
      remote = null;
      move(from, video, video.paused);
    },
  };
}
