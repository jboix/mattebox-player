/**
 * Chinese words of the ad elements, for `MatteboxPlayerElement.addLocale('zh', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { AdsMessages } from '../messages.js';

export default {
  adLabel: '广告',
  adCount: '广告 {index}/{total}',
  adSkip: '跳过广告',
  adSkipIn: '{seconds} 秒后可跳过',
  adLearnMore: '了解详情',
  adBreak: '广告时间，{seconds} 秒',
  adPromo: '推广',
  adPromoCount: '推广 {index}/{total}',
  adSkipPromo: '跳过推广',
} satisfies AdsMessages;
