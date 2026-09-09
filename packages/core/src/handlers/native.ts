/**
 * The native handler: the browser plays the source itself. This is the only
 * place in the core that writes to the DOM, and it writes one property.
 *
 * Attach and `src` exclude each other, so whatever holds the element is
 * detached first; the engine never takes an element over silently and throws
 * `CONFIG_ELEMENT_OCCUPIED` on one that already has a `src`.
 */
import { mattebox } from 'mattebox';
import type { CanHandle, Handler, HandlerEnvironment, Session, Source } from '../types.js';

const NAME = 'native';

export function nativeHandler(): Handler {
  function canHandle(source: Source, env: HandlerEnvironment): CanHandle {
    // No type means the element decides once the bytes arrive, which is a maybe.
    if (source.type === undefined) return 'maybe';
    return env.video.canPlayType(source.type) as CanHandle;
  }

  async function handle(source: Source, video: HTMLMediaElement): Promise<Session> {
    const held = mattebox.from(video);
    if (held !== null) await held.detach();
    video.src = source.url;

    async function dispose(): Promise<void> {
      // Removing the attribute is not enough: without `load()` the element
      // keeps the old resource selected and the next attach is refused.
      video.removeAttribute('src');
      video.load();
    }

    return { handler: NAME, engine: null, dispose };
  }

  return { name: NAME, canHandle, handle };
}
