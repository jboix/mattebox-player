/**
 * Korean words of the ad elements, for `MatteboxPlayerElement.addLocale('ko', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { AdsMessages } from '../messages.js';

export default {
  adLabel: '광고',
  adCount: '광고 {index}/{total}',
  adSkip: '광고 건너뛰기',
  adSkipIn: '{seconds}초 후 건너뛰기',
  adLearnMore: '자세히 알아보기',
  adBreak: '광고 시간, {seconds}초',
  adPromo: '프로모션',
  adPromoCount: '프로모션 {index}/{total}',
  adSkipPromo: '프로모션 건너뛰기',
} satisfies AdsMessages;
