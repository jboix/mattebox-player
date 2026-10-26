/**
 * Hindi words of the playlist, for `MatteboxPlayerElement.addLocale('hi', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { PlaylistMessages } from '../messages.js';

export default {
  playlist: 'प्लेलिस्ट',
  playlistPrevious: 'पिछला',
  playlistNext: 'अगला',
  playlistClose: 'बंद करें',
  playlistShuffle: 'शफ़ल',
  playlistRepeatAll: 'सभी दोहराएँ',
  playlistRepeatOne: 'एक दोहराएँ',
  playlistRepeatOff: 'दोहराना बंद',
  upNext: 'आगे',
  upNextPlay: 'अगला एपिसोड',
  upNextDismiss: 'बंद करें',
  upNextCountdown: '{seconds} सेकंड में',
} satisfies PlaylistMessages;
