/**
 * German words of the playlist, for `MatteboxPlayerElement.addLocale('de', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { PlaylistMessages } from '../messages.js';

export default {
  playlist: 'Wiedergabeliste',
  playlistPrevious: 'Zurück',
  playlistNext: 'Weiter',
  playlistClose: 'Schließen',
  playlistShuffle: 'Zufällig',
  playlistRepeatAll: 'Alle wiederholen',
  playlistRepeatOne: 'Eins wiederholen',
  playlistRepeatOff: 'Wiederholen aus',
  upNext: 'Als Nächstes',
  upNextPlay: 'Nächste Folge',
  upNextDismiss: 'Schließen',
  upNextCountdown: 'in {seconds} s',
} satisfies PlaylistMessages;
