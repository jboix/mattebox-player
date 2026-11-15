/**
 * Japanese words of the live captions, for `MatteboxPlayerElement.addLocale('ja', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { LiveCaptionsMessages } from '../messages.js';

export default {
  liveCaptionsPreparing: 'ライブ字幕を準備しています',
  liveCaptionsLanguage: 'この言語ではライブ字幕を利用できません',
  liveCaptionsDownload: 'ライブ字幕をダウンロードできませんでした',
  liveCaptionsError: 'ライブ字幕が停止しました',
  liveCaptionsSource: 'ライブ字幕はこの動画を聞き取れません',
} satisfies LiveCaptionsMessages;
