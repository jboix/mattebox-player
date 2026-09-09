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
  active(): boolean;
  toggle(): void;
  /** Runs `fn` on every change. Returns the unsubscribe. */
  watch(fn: () => void): () => void;
}

function watching(target: EventTarget, names: readonly string[]) {
  return (fn: () => void): (() => void) => {
    for (const name of names) target.addEventListener(name, fn);
    return () => {
      for (const name of names) target.removeEventListener(name, fn);
    };
  };
}

export function pictureInPicture(video: HTMLVideoElement): PictureInPicture {
  const safari = video as HTMLVideoElement & PresentationVideo;

  if (typeof video.requestPictureInPicture === 'function' && document.pictureInPictureEnabled) {
    return {
      supported: true,
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
    active: () => false,
    toggle(): void {},
    watch: () => () => {},
  };
}
