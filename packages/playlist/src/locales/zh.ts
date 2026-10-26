/**
 * Simplified Chinese words of the playlist, for `MatteboxPlayerElement.addLocale('zh', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { PlaylistMessages } from '../messages.js';

export default {
  playlist: '播放列表',
  playlistPrevious: '上一个',
  playlistNext: '下一个',
  playlistClose: '关闭',
  playlistShuffle: '随机播放',
  playlistRepeatAll: '全部循环',
  playlistRepeatOne: '单个循环',
  playlistRepeatOff: '关闭循环',
  upNext: '即将播放',
  upNextPlay: '下一集',
  upNextDismiss: '关闭',
  upNextCountdown: '{seconds} 秒后',
} satisfies PlaylistMessages;
