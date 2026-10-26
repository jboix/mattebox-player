/**
 * Japanese words of the playlist, for `MatteboxPlayerElement.addLocale('ja', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { PlaylistMessages } from '../messages.js';

export default {
  playlist: '再生リスト',
  playlistPrevious: '前へ',
  playlistNext: '次へ',
  playlistClose: '閉じる',
  playlistShuffle: 'シャッフル',
  playlistRepeatAll: 'すべてリピート',
  playlistRepeatOne: '1件リピート',
  playlistRepeatOff: 'リピートオフ',
  upNext: '次の動画',
  upNextPlay: '次のエピソード',
  upNextDismiss: '閉じる',
  upNextCountdown: '{seconds} 秒後',
} satisfies PlaylistMessages;
