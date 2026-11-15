/**
 * Chinese words of the live captions, for `MatteboxPlayerElement.addLocale('zh', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { LiveCaptionsMessages } from '../messages.js';

export default {
  liveCaptionsPreparing: '正在准备实时字幕',
  liveCaptionsLanguage: '此语言不支持实时字幕',
  liveCaptionsDownload: '无法下载实时字幕',
  liveCaptionsError: '实时字幕已停止',
  liveCaptionsSource: '实时字幕无法收听此视频',
} satisfies LiveCaptionsMessages;
