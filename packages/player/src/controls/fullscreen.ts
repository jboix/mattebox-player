/**
 * Fullscreen on the player itself, so the video and every control in it
 * come along, through whichever API the browser has. Three shapes, tried
 * in order: the standard one; the `webkit` prefix on elements, which
 * Safari kept until 16.4; and the iPhone, which has fullscreen on the
 * video alone. None of them means no button.
 *
 * "Active" is whether the host is the fullscreen element, which `:fullscreen`
 * answers whatever tree the host is in: `document.fullscreenElement` is
 * retargeted when the host sits in a shadow root, and the pseudo-class is not.
 */

interface PrefixedElement {
  webkitRequestFullscreen?: () => void;
}

interface PrefixedVideo {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  readonly webkitDisplayingFullscreen?: boolean;
}

interface PrefixedDocument {
  readonly webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
}

export interface Fullscreen {
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

export function fullscreen(host: HTMLElement, video: HTMLVideoElement): Fullscreen {
  const doc = document as Document & PrefixedDocument;
  const prefixed = host as HTMLElement & PrefixedElement;
  const phone = video as HTMLVideoElement & PrefixedVideo;

  if (typeof host.requestFullscreen === 'function') {
    const active = (): boolean => host.matches(':fullscreen');
    return {
      supported: true,
      active,
      toggle(): void {
        // Both return promises that reject outside a user gesture or where
        // the page forbids it; there is nothing to do with that but drop it.
        const request = active() ? document.exitFullscreen() : host.requestFullscreen();
        request.catch(() => undefined);
      },
      watch: watching(document, ['fullscreenchange']),
    };
  }

  if (typeof prefixed.webkitRequestFullscreen === 'function') {
    const active = (): boolean => doc.webkitFullscreenElement === host;
    return {
      supported: true,
      active,
      toggle(): void {
        if (active()) doc.webkitExitFullscreen?.();
        else prefixed.webkitRequestFullscreen?.();
      },
      watch: watching(document, ['webkitfullscreenchange']),
    };
  }

  if (typeof phone.webkitEnterFullscreen === 'function') {
    return {
      supported: true,
      active: () => phone.webkitDisplayingFullscreen === true,
      toggle(): void {
        if (phone.webkitDisplayingFullscreen === true) phone.webkitExitFullscreen?.();
        else phone.webkitEnterFullscreen?.();
      },
      watch: watching(video, ['webkitbeginfullscreen', 'webkitendfullscreen']),
    };
  }

  return {
    supported: false,
    active: () => false,
    toggle(): void {},
    watch: () => () => {},
  };
}
