/**
 * AirPlay on the video, through Apple's WebKit API. The standard
 * RemotePlayback API is deliberately not used: `video.remote` also exists
 * on Chrome for Android, where it means Cast, and a button named AirPlay
 * has to mean AirPlay.
 *
 * The target list is not watched. Safari's availability event flips while
 * the same targets are there, which makes a button that follows it appear
 * and disappear; the AirPlay button in the SRG SSR player stopped
 * following it for that reason. What is watched is `disableRemotePlayback`,
 * which the engine sets when it opens a ManagedMediaSource without an
 * AirPlay source alternative. Safari offers no target on such an element,
 * so the button has nothing to open.
 */

interface AirplayVideo {
  webkitShowPlaybackTargetPicker?: () => void;
  readonly webkitCurrentPlaybackTargetIsWireless?: boolean;
}

export interface Airplay {
  /** Whether this browser has the API at all. Without it the button is hidden. */
  readonly supported: boolean;
  /** Whether the element can offer a target, which remote playback being disabled takes away. */
  offered(): boolean;
  /** Whether the video is playing on a target. */
  active(): boolean;
  /** Opens the picker. Safari requires a user gesture, so this runs straight from the click. */
  show(): void;
  /** Runs `fn` whenever the video moves onto or off a target. Returns the unsubscribe. */
  watch(fn: () => void): () => void;
}

const WIRELESS_CHANGED = 'webkitcurrentplaybacktargetiswirelesschanged';

export function airplay(video: HTMLVideoElement): Airplay {
  const apple = video as HTMLVideoElement & AirplayVideo;
  // The event class, not the method: it is the feature test Safari's own
  // documentation gives, and the one the SRG SSR player uses.
  const supported =
    'WebKitPlaybackTargetAvailabilityEvent' in globalThis &&
    typeof apple.webkitShowPlaybackTargetPicker === 'function';

  if (!supported) {
    return {
      supported: false,
      offered: () => false,
      active: () => false,
      show(): void {},
      watch: () => () => {},
    };
  }

  return {
    supported: true,
    offered: () => video.disableRemotePlayback !== true,
    active: () => apple.webkitCurrentPlaybackTargetIsWireless === true,
    show(): void {
      apple.webkitShowPlaybackTargetPicker?.();
    },
    watch(fn: () => void): () => void {
      video.addEventListener(WIRELESS_CHANGED, fn);
      return () => {
        video.removeEventListener(WIRELESS_CHANGED, fn);
      };
    },
  };
}
