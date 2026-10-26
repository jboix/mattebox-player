/**
 * Korean words of the playlist, for `MatteboxPlayerElement.addLocale('ko', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { PlaylistMessages } from '../messages.js';

export default {
  playlist: '재생목록',
  playlistPrevious: '이전',
  playlistNext: '다음',
  playlistClose: '닫기',
  playlistShuffle: '셔플',
  playlistRepeatAll: '전체 반복',
  playlistRepeatOne: '한 개 반복',
  playlistRepeatOff: '반복 끔',
  upNext: '다음 영상',
  upNextPlay: '다음 에피소드',
  upNextDismiss: '닫기',
  upNextCountdown: '{seconds}초 후',
} satisfies PlaylistMessages;
