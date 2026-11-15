/** A `<style>` with `text`, for a shadow root. */
export function style(text: string): HTMLStyleElement {
  const node = document.createElement('style');
  node.textContent = text;
  return node;
}

/**
 * The player's attribute that carries live captions: absent where the
 * browser cannot recognize speech, `off`, or `on`. The player's subtitles
 * menu reads and writes the same attribute.
 */
export const LIVE_CAPTIONS = 'live-captions';
