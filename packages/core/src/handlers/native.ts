/**
 * The native handler: the browser plays the source itself. This is the only
 * place in the core that writes to the DOM, and it writes one property.
 *
 * Attach and `src` exclude each other, so whatever holds the element is
 * detached first; the engine never takes an element over silently and throws
 * `CONFIG_ELEMENT_OCCUPIED` on one that already has a `src`.
 */
import { mattebox } from 'mattebox';
import type { AttachEmeOptions, EmeAttachment } from 'mattebox/eme';
import { attachEme } from 'mattebox/eme';
import type { CanHandle, Handler, HandlerEnvironment, HandlerSession, Source } from '../types.js';

const NAME = 'native';

export interface NativeHandlerOptions {
  /**
   * True asks the native handler first for the source, ahead of the
   * handlers before it in the chain. The element passes `preferNativeHls`.
   */
  readonly prefer?: (source: Source, env: HandlerEnvironment) => boolean;
  /**
   * The engine's DRM for the source, attached to the video before `src`:
   * key systems, license URLs and a request hook, as `attachEme` takes
   * them. A function answers per source, and undefined plays without DRM.
   */
  readonly drm?: AttachEmeOptions | ((source: Source) => AttachEmeOptions | undefined);
}

/** The HLS types `inferType` and the pages give. */
const HLS = ['application/vnd.apple.mpegurl', 'application/x-mpegurl'];

/**
 * Whether the browser is Apple's WebKit and plays this HLS source itself.
 * The vendor string is the one value every WebKit browser shares, without
 * parsing the user agent. Android Chrome also answers `canPlayType` for
 * HLS, and the vendor check keeps it on the engine.
 */
export function preferNativeHls(source: Source, env: HandlerEnvironment): boolean {
  const type = source.type?.toLowerCase();
  return (
    type !== undefined &&
    HLS.includes(type) &&
    env.video.canPlayType(HLS[0] as string) !== '' &&
    navigator.vendor.startsWith('Apple')
  );
}

export function nativeHandler(options: NativeHandlerOptions = {}): Handler {
  function canHandle(source: Source, env: HandlerEnvironment): CanHandle {
    // No type means the element decides once the bytes arrive, which is a maybe.
    if (source.type === undefined) return 'maybe';
    return env.video.canPlayType(source.type) as CanHandle;
  }

  async function handle(source: Source, video: HTMLMediaElement): Promise<HandlerSession> {
    const held = mattebox.from(video);
    if (held !== null) await held.detach();
    // An engine session before this one may have left remote playback
    // disabled, which is what a ManagedMediaSource needs and what takes
    // the AirPlay target away. The browser plays this source itself, so
    // the target belongs back.
    video.disableRemotePlayback = false;
    const drm = typeof options.drm === 'function' ? options.drm(source) : options.drm;
    // Before `src`, so no `encrypted` event is missed. The player's CDN
    // bundle reads `attachEme` from the engine's global, and only the
    // engine bundles with DRM carry it: without it the source plays as
    // it would with no DRM option.
    const eme: EmeAttachment | undefined =
      drm !== undefined && typeof attachEme === 'function' ? attachEme(video, drm) : undefined;
    video.src = source.url;

    async function dispose(): Promise<void> {
      // Removing the attribute is not enough: without `load()` the element
      // keeps the old resource selected and the next attach is refused.
      video.removeAttribute('src');
      video.load();
      // After the source is gone, so no frame needs the keys it clears.
      eme?.detach();
    }

    return eme === undefined
      ? { handler: NAME, engine: null, dispose }
      : { handler: NAME, engine: null, eme, dispose };
  }

  return options.prefer === undefined
    ? { name: NAME, canHandle, handle }
    : { name: NAME, canHandle, prefers: options.prefer, handle };
}
