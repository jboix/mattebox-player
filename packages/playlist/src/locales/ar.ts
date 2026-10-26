/**
 * Arabic words of the playlist, for `MatteboxPlayerElement.addLocale('ar', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { PlaylistMessages } from '../messages.js';

export default {
  playlist: 'قائمة التشغيل',
  playlistPrevious: 'السابق',
  playlistNext: 'التالي',
  playlistClose: 'إغلاق',
  playlistShuffle: 'عشوائي',
  playlistRepeatAll: 'تكرار الكل',
  playlistRepeatOne: 'تكرار واحد',
  playlistRepeatOff: 'إيقاف التكرار',
  upNext: 'يُعرض تاليًا',
  upNextPlay: 'الحلقة التالية',
  upNextDismiss: 'إغلاق',
  upNextCountdown: 'خلال {seconds} ث',
} satisfies PlaylistMessages;
