/**
 * The browser's speech recognition, over an audio track instead of the
 * microphone. Web Speech API: `start(track)`, and `processLocally` with
 * `SpeechRecognition.available()` and `install()` for recognition on the
 * device. Both are experimental, and Chrome is the one browser that has
 * them, so every member is detected before use.
 *
 * The recognizer runs in sessions. A session ends after a silence, or after
 * a time the browser decides, and the next one starts at once, so the
 * caller sees one stream of results.
 */
import { capturable } from './audio.js';
import type { Phrase } from './transcript.js';

/** The members this package uses, which the DOM types of TypeScript do not all have yet. */
interface Recognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  start(track?: MediaStreamTrack): void;
  stop(): void;
  abort(): void;
}

interface RecognitionResultEvent extends Event {
  readonly results: ArrayLike<
    ArrayLike<{ readonly transcript: string }> & { readonly isFinal: boolean }
  >;
}

interface RecognitionErrorEvent extends Event {
  readonly error: string;
}

export type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

interface RecognitionOptions {
  readonly langs: readonly string[];
  readonly processLocally: boolean;
}

interface RecognitionClass {
  new (): Recognition;
  available?(options: RecognitionOptions): Promise<Availability>;
  install?(options: RecognitionOptions): Promise<boolean>;
}

/** Why live captions could not start, for the words the element shows. */
export type Failure = 'language' | 'download' | 'source' | 'error';

/** The browser's class, unprefixed first: Chrome's prefixed one predates `start(track)`. */
function recognitionClass(view: Window = window): RecognitionClass | null {
  const found = view as unknown as {
    SpeechRecognition?: RecognitionClass;
    webkitSpeechRecognition?: RecognitionClass;
  };
  return found.SpeechRecognition ?? found.webkitSpeechRecognition ?? null;
}

let tested: boolean | undefined;

/**
 * Whether recognition takes an audio track, and, unless `cloud` allows a
 * server, whether it runs on the device. `start(0)` throws a TypeError where
 * `start` takes a track, and is ignored, starting the microphone, where it
 * does not. It runs in a detached frame, as Shaka Player does, so a browser
 * that ignores the argument denies the microphone at once and asks nothing.
 */
export function supported(cloud: boolean): boolean {
  const Class = recognitionClass();
  if (Class === null || !capturable()) return false;
  if (!cloud && typeof Class.available !== 'function') return false;
  if (tested === undefined) {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const inner = frame.contentWindow === null ? null : recognitionClass(frame.contentWindow);
    if (inner === null) {
      frame.remove();
      tested = false;
    } else {
      const recognition = new inner();
      frame.remove();
      try {
        recognition.start(0 as unknown as MediaStreamTrack);
        recognition.abort();
        tested = false;
      } catch (error) {
        // The error comes from the frame's realm, so it is no instance of this window's Error: read its name.
        tested = (error as { name?: unknown } | null)?.name === 'TypeError';
      }
    }
  }
  return tested;
}

/**
 * Whether the recognizer takes `lang`: on the device, or on a server with
 * `cloud`. 'downloadable' and 'downloading' mean the device takes it once
 * `prepare` downloaded it. A browser without `available()` recognizes on a
 * server alone, and does not say which languages.
 */
export async function availability(lang: string, cloud: boolean): Promise<Availability> {
  const Class = recognitionClass();
  if (Class === null) return 'unavailable';
  if (typeof Class.available !== 'function') return cloud ? 'available' : 'unavailable';
  try {
    return await Class.available({ langs: [lang], processLocally: !cloud });
  } catch {
    // A tag the browser cannot parse.
    return 'unavailable';
  }
}

/**
 * Makes `lang` ready to recognize: on the device, available now or
 * downloaded. `install()` needs a user's gesture, so this runs in the
 * handler of the click that turned live captions on. Returns null when it
 * is ready, else why not.
 */
export async function prepare(lang: string, cloud: boolean): Promise<Failure | null> {
  const status = await availability(lang, cloud);
  if (status === 'available') return null;
  if (status === 'unavailable') return 'language';
  const options = { langs: [lang], processLocally: true };
  const installed = (await recognitionClass()?.install?.(options)) ?? false;
  return installed ? null : 'download';
}

export interface Recognizer {
  /** Stops for good. No result arrives after it. */
  stop(): void;
}

export interface RecognizerHandlers {
  /** The current session's results, final ones first. */
  results(phrases: readonly Phrase[]): void;
  /** A session ended. The next one starts by itself. */
  ended(): void;
  /** Recognition stopped and will not start again. */
  failed(failure: Failure): void;
}

/** A pause before the next session after an error, so a failing recognizer does not spin. */
const RETRY_MS = 1000;

/** Recognizes `track` in `lang`, session after session, until `stop`. */
export function recognize(
  track: MediaStreamTrack,
  lang: string,
  cloud: boolean,
  handlers: RecognizerHandlers,
): Recognizer {
  const Class = recognitionClass();
  let live = Class !== null;
  let current: Recognition | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function session(): void {
    if (!live || Class === null) return;
    const recognition = new Class();
    current = recognition;
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    if (!cloud) recognition.processLocally = true;
    let failed = false;
    recognition.addEventListener('result', (event) => {
      if (recognition !== current) return;
      const { results } = event as RecognitionResultEvent;
      const phrases: Phrase[] = [];
      for (let i = 0; i < results.length; i += 1) {
        const result = results[i];
        if (result === undefined) continue;
        phrases.push({ text: result[0]?.transcript ?? '', final: result.isFinal });
      }
      handlers.results(phrases);
    });
    recognition.addEventListener('error', (event) => {
      if (recognition !== current) return;
      const { error } = event as RecognitionErrorEvent;
      // Silence and an abort are part of a session's life, not failures.
      if (error === 'no-speech' || error === 'aborted') return;
      failed = true;
      if (error === 'language-not-supported') {
        live = false;
        handlers.failed('language');
      }
    });
    recognition.addEventListener('end', () => {
      if (recognition !== current) return;
      handlers.ended();
      if (!live) return;
      if (failed) timer = setTimeout(session, RETRY_MS);
      else session();
    });
    try {
      recognition.start(track);
    } catch {
      live = false;
      handlers.failed('error');
    }
  }

  session();
  return {
    stop() {
      live = false;
      clearTimeout(timer);
      const recognition = current;
      current = null;
      recognition?.abort();
    },
  };
}
