/**
 * Picture-in-Picture on the video, through whichever API the browser has:
 * the standard one, or Safari's presentation mode. Neither means no
 * button. Both live on the video itself, which is where the browser draws
 * the floating window from.
 */

interface PresentationVideo {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  readonly webkitPresentationMode?: string;
}

export interface PictureInPicture {
  /** Whether any API exists. Without one the button is hidden. */
  readonly supported: boolean;
  /**
   * Whether the page allows it: false while the video has
   * `disablepictureinpicture`, which makes the browser refuse the request.
   * Read from the attribute, since Firefox has no such property.
   */
  allowed(): boolean;
  active(): boolean;
  toggle(): void;
  /** Runs `fn` on every change. Returns the unsubscribe. */
  watch(fn: () => void): () => void;
}

/** The attribute that turns picture in picture off for one video. */
const DISABLE = 'disablepictureinpicture';

/** Watches `names` on the video, and the attribute that turns the feature off. */
function watching(video: HTMLVideoElement, names: readonly string[]) {
  return (fn: () => void): (() => void) => {
    for (const name of names) video.addEventListener(name, fn);
    const observer = new MutationObserver(fn);
    observer.observe(video, { attributes: true, attributeFilter: [DISABLE] });
    return () => {
      for (const name of names) video.removeEventListener(name, fn);
      observer.disconnect();
    };
  };
}

export function pictureInPicture(video: HTMLVideoElement): PictureInPicture {
  const safari = video as HTMLVideoElement & PresentationVideo;
  const allowed = (): boolean => !video.hasAttribute(DISABLE);

  if (typeof video.requestPictureInPicture === 'function' && document.pictureInPictureEnabled) {
    return {
      supported: true,
      allowed,
      active: () => document.pictureInPictureElement === video,
      toggle(): void {
        // Rejected outside a user gesture, or before the video has metadata;
        // nothing to do with that but drop it.
        const request =
          document.pictureInPictureElement === video
            ? document.exitPictureInPicture()
            : video.requestPictureInPicture();
        request.catch(() => undefined);
      },
      watch: watching(video, ['enterpictureinpicture', 'leavepictureinpicture']),
    };
  }

  if (
    typeof safari.webkitSetPresentationMode === 'function' &&
    safari.webkitSupportsPresentationMode?.('picture-in-picture') === true
  ) {
    return {
      supported: true,
      allowed,
      active: () => safari.webkitPresentationMode === 'picture-in-picture',
      toggle(): void {
        const next =
          safari.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture';
        safari.webkitSetPresentationMode?.(next);
      },
      watch: watching(video, ['webkitpresentationmodechanged']),
    };
  }

  return {
    supported: false,
    allowed,
    active: () => false,
    toggle(): void {},
    watch: () => () => {},
  };
}
