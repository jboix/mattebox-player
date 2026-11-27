/**
 * Arabic words of the transcript, for `MatteboxPlayerElement.addLocale('ar', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { TranscriptMessages } from '../messages.js';

export default {
  transcript: 'النص المكتوب',
  transcriptClose: 'إغلاق',
  transcriptLanguage: 'اللغة',
  transcriptSubtitles: 'الترجمة',
  transcriptNone: 'بلا',
  transcriptTrack: 'المسار',
  transcriptSearch: 'بحث',
  transcriptPrevious: 'النتيجة السابقة',
  transcriptNext: 'النتيجة التالية',
  transcriptCount: '{at} من {count}',
  transcriptNoMatch: 'لا توجد نتائج',
  transcriptSearchFailed: 'البحث غير متاح',
  transcriptBlocked: 'هذا الجزء غير متاح',
  transcriptRange: 'من {start} إلى {end}',
  transcriptMore: 'تحميل سطور أخرى',
  transcriptLoading: 'جارٍ تحميل سطور أخرى',
  transcriptPartial: 'جارٍ تحميل سطور أخرى. يشمل البحث السطور المحمّلة حتى الآن.',
  transcriptChoose: 'اختر لغة لقراءة النص المكتوب.',
  transcriptEmpty: 'لا توجد سطور بهذه اللغة.',
} satisfies TranscriptMessages;
