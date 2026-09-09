/**
 * Fullscreen on the stage, which is the video and the bar and nothing
 * else, through whichever API the browser has. Three shapes, tried in
 * order: the standard one; the `webkit` prefix on elements, which Safari
 * kept until 16.4; and the iPhone, which has fullscreen on the video alone.
 * None of them means no button.
 *
 * The stage is in shadow DOM, so `document.fullscreenElement` reports the
 * host, retargeted; "active" is whether the fullscreen element is the host
 * or inside it.
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

export function fullscreen(
  host: HTMLElement,
  stage: HTMLElement,
  video: HTMLVideoElement,
): Fullscreen {
  const doc = document as Document & PrefixedDocument;
  const prefixed = stage as HTMLElement & PrefixedElement;
  const phone = video as HTMLVideoElement & PrefixedVideo;

  /** Whether `node` is the host or inside it, which is what a retargeted fullscreen element is. */
  function within(node: Element | null | undefined): boolean {
    return node !== null && node !== undefined && host.contains(node);
  }

  if (typeof stage.requestFullscreen === 'function') {
    return {
      supported: true,
      active: () => within(document.fullscreenElement),
      toggle(): void {
        // Both return promises that reject outside a user gesture or where
        // the page forbids it; there is nothing to do with that but drop it.
        const request = within(document.fullscreenElement)
          ? document.exitFullscreen()
          : stage.requestFullscreen();
        request.catch(() => undefined);
      },
      watch: watching(document, ['fullscreenchange']),
    };
  }

  if (typeof prefixed.webkitRequestFullscreen === 'function') {
    return {
      supported: true,
      active: () => within(doc.webkitFullscreenElement),
      toggle(): void {
        if (within(doc.webkitFullscreenElement)) doc.webkitExitFullscreen?.();
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
