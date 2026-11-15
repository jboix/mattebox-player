/**
 * Arabic words of the live captions, for `MatteboxPlayerElement.addLocale('ar', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { LiveCaptionsMessages } from '../messages.js';

export default {
  liveCaptionsPreparing: 'جارٍ تجهيز الترجمة المباشرة',
  liveCaptionsLanguage: 'الترجمة المباشرة غير متاحة بهذه اللغة',
  liveCaptionsDownload: 'تعذّر تنزيل الترجمة المباشرة',
  liveCaptionsError: 'توقفت الترجمة المباشرة',
  liveCaptionsSource: 'لا تستطيع الترجمة المباشرة الاستماع إلى هذا الفيديو',
} satisfies LiveCaptionsMessages;
