/**
 * @mattebox/player-live-captions: live captions in <mattebox-player>. The
 * browser's speech recognition writes what is said in the video, word by
 * word, over the picture. <mbx-live-captions> recognizes and draws, and
 * offers live captions to the player's subtitles menu, which turns them on
 * and off. Importing this module registers the element; that is the
 * package's one side effect.
 */
import { MbxLiveCaptions } from './element.js';

export type { TranscriptDetail, Unavailable, UnavailableDetail } from './element.js';
export { MbxLiveCaptions } from './element.js';
export type { LiveCaptionsMessages } from './messages.js';

if (customElements.get('mbx-live-captions') === undefined) {
  customElements.define('mbx-live-captions', MbxLiveCaptions);
}

declare global {
  interface HTMLElementTagNameMap {
    'mbx-live-captions': MbxLiveCaptions;
  }
  interface HTMLElementEventMap {
    transcript: CustomEvent<import('./element.js').TranscriptDetail>;
    unavailable: CustomEvent<import('./element.js').UnavailableDetail>;
  }
}
