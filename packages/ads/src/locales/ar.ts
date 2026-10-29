/**
 * Arabic words of the ad elements, for `MatteboxPlayerElement.addLocale('ar', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { AdsMessages } from '../messages.js';

export default {
  adLabel: 'إعلان',
  adCount: 'إعلان {index} من {total}',
  adSkip: 'تخطي الإعلان',
  adSkipIn: 'تخطٍّ بعد {seconds}',
  adLearnMore: 'اعرف المزيد',
  adBreak: 'فاصل إعلاني، {seconds} ثانية',
  adPromo: 'ترويج',
  adPromoCount: 'ترويج {index} من {total}',
  adSkipPromo: 'تخطي الترويج',
} satisfies AdsMessages;
