/**
 * Catalan words of the playlist, for `MatteboxPlayerElement.addLocale('ca', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { PlaylistMessages } from '../messages.js';

export default {
  playlist: 'Llista de reproducció',
  playlistPrevious: 'Anterior',
  playlistNext: 'Següent',
  playlistClose: 'Tanca',
  playlistShuffle: 'Aleatori',
  playlistRepeatAll: 'Repeteix-ho tot',
  playlistRepeatOne: 'Repeteix-ne un',
  playlistRepeatOff: 'Repetició desactivada',
  upNext: 'A continuació',
  upNextPlay: 'Episodi següent',
  upNextDismiss: 'Tanca',
  upNextCountdown: "d'aquí a {seconds} s",
} satisfies PlaylistMessages;
