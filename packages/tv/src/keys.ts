/**
 * The keys of a TV remote, as the standard `KeyboardEvent.key` names the
 * player reads. Tizen and webOS report several remote keys by `keyCode`
 * alone, with an empty, `Unidentified`, or vendor `key`. The arrows and
 * Enter come the same way on older sets.
 *
 * Back: 10009 on Tizen, 461 on webOS. Media keys: Samsung's Tizen TV key
 * list and LG's webOS TV key codes. The codes shared with a desktop
 * keyboard (the arrows, Enter) map only when `key` names nothing.
 */
const BY_CODE: Readonly<Record<number, string>> = {
  10009: 'GoBack',
  461: 'GoBack',
  10252: 'MediaPlayPause',
  415: 'MediaPlay',
  19: 'MediaPause',
  413: 'MediaStop',
  417: 'MediaFastForward',
  412: 'MediaRewind',
};

/** Keys a desktop keyboard also sends, by code, for sets that leave `key` empty. */
const PLAIN: Readonly<Record<number, string>> = {
  13: 'Enter',
  37: 'ArrowLeft',
  38: 'ArrowUp',
  39: 'ArrowRight',
  40: 'ArrowDown',
};

/** The standard name of the key `event` reports: its own `key` when it has one the player reads. */
export function keyOf(event: KeyboardEvent): string {
  const remote = BY_CODE[event.keyCode];
  if (remote !== undefined) return remote;
  const named = event.key !== '' && event.key !== 'Unidentified';
  return named ? event.key : (PLAIN[event.keyCode] ?? event.key);
}

/** The keys that go back: the remote's Back, the browser's, and Escape. */
export function isBack(key: string): boolean {
  return key === 'GoBack' || key === 'BrowserBack' || key === 'Escape';
}
