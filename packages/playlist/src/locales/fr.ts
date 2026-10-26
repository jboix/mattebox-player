/**
 * French words of the playlist, for `MatteboxPlayerElement.addLocale('fr', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { PlaylistMessages } from '../messages.js';

export default {
  playlist: 'Liste de lecture',
  playlistPrevious: 'Précédent',
  playlistNext: 'Suivant',
  playlistClose: 'Fermer',
  playlistShuffle: 'Aléatoire',
  playlistRepeatAll: 'Tout répéter',
  playlistRepeatOne: 'Répéter un',
  playlistRepeatOff: 'Répétition désactivée',
  upNext: 'À suivre',
  upNextPlay: 'Épisode suivant',
  upNextDismiss: 'Fermer',
  upNextCountdown: 'dans {seconds} s',
} satisfies PlaylistMessages;
