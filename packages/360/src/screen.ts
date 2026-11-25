/**
 * Fullscreen on the player element, for the split screen: the two halves
 * must fill the phone's screen. Two shapes, the first two of the player's
 * own fullscreen control: the standard API, and the `webkit` prefix on
 * elements, which Safari kept until 16.4.
 *
 * An iPhone has neither. Its fullscreen is on the video alone, which shows
 * the flat picture and not the view. `fills()` is false there, so the
 * split screen is not offered.
 */

interface PrefixedElement {
  webkitRequestFullscreen?: () => void;
}

interface PrefixedDocument {
  readonly webkitFullscreenEnabled?: boolean;
  readonly webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
}

/** The screen's orientation, with the lock that TypeScript's DOM library does not type. */
interface Lockable {
  lock?: (orientation: 'landscape') => Promise<void>;
  unlock?: () => void;
}

/** The events that say an element entered or left fullscreen, or was refused. */
export const FULLSCREEN_EVENTS: readonly string[] = [
  'fullscreenchange',
  'webkitfullscreenchange',
  'fullscreenerror',
  'webkitfullscreenerror',
];

/** Whether `host` itself can go fullscreen: the browser has the API, and the page may use it. */
export function fills(host: HTMLElement): boolean {
  const doc = document as Document & PrefixedDocument;
  // A frame without `allowfullscreen` has the method and the answer false.
  if (typeof host.requestFullscreen === 'function') return doc.fullscreenEnabled !== false;
  if (typeof (host as HTMLElement & PrefixedElement).webkitRequestFullscreen === 'function')
    return doc.webkitFullscreenEnabled !== false;
  return false;
}

/** Whether `host` is the fullscreen element. */
export function filling(host: HTMLElement): boolean {
  // `:fullscreen` answers whatever tree the host is in, as in the player's control.
  if (typeof host.requestFullscreen === 'function') return host.matches(':fullscreen');
  return (document as Document & PrefixedDocument).webkitFullscreenElement === host;
}

/** Takes `host` fullscreen. Rejects where the browser refuses. The prefixed shape says so only by an event. */
export function fill(host: HTMLElement): Promise<void> {
  if (typeof host.requestFullscreen === 'function') return host.requestFullscreen();
  const prefixed = host as HTMLElement & PrefixedElement;
  if (typeof prefixed.webkitRequestFullscreen !== 'function')
    return Promise.reject(new DOMException('No fullscreen on an element', 'NotSupportedError'));
  prefixed.webkitRequestFullscreen();
  return Promise.resolve();
}

/** Leaves fullscreen. */
export function unfill(): Promise<void> {
  if (typeof document.exitFullscreen === 'function') return document.exitFullscreen();
  (document as Document & PrefixedDocument).webkitExitFullscreen?.();
  return Promise.resolve();
}

/**
 * Turns the screen to landscape, where the browser lets a fullscreen page
 * do it: a viewer holds the phone on its side. A refusal changes nothing,
 * and the viewer turns the phone.
 */
export function landscape(): void {
  const orientation = screen.orientation as (ScreenOrientation & Lockable) | undefined;
  if (typeof orientation?.lock !== 'function') return;
  try {
    orientation.lock('landscape').catch(() => undefined);
  } catch {
    // An older browser throws where a newer one rejects.
  }
}

/** Lets the screen turn again. Leaving fullscreen does it too; this is for a player that stays fullscreen. */
export function upright(): void {
  const orientation = screen.orientation as (ScreenOrientation & Lockable) | undefined;
  if (typeof orientation?.unlock !== 'function') return;
  try {
    orientation.unlock();
  } catch {
    // Nothing was locked.
  }
}
