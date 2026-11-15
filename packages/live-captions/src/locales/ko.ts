/**
 * Korean words of the live captions, for `MatteboxPlayerElement.addLocale('ko', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { LiveCaptionsMessages } from '../messages.js';

export default {
  liveCaptionsPreparing: '실시간 자막을 준비하는 중',
  liveCaptionsLanguage: '이 언어에서는 실시간 자막을 사용할 수 없습니다',
  liveCaptionsDownload: '실시간 자막을 다운로드할 수 없습니다',
  liveCaptionsError: '실시간 자막이 중지되었습니다',
  liveCaptionsSource: '실시간 자막이 이 동영상을 들을 수 없습니다',
} satisfies LiveCaptionsMessages;
