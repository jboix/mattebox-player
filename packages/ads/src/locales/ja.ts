/**
 * Japanese words of the ad elements, for `MatteboxPlayerElement.addLocale('ja', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { AdsMessages } from '../messages.js';

export default {
  adLabel: '広告',
  adCount: '広告 {index}/{total}',
  adSkip: '広告をスキップ',
  adSkipIn: '{seconds} 秒後にスキップ',
  adLearnMore: '詳細',
  adBreak: '広告、{seconds} 秒',
  adPromo: 'プロモーション',
  adPromoCount: 'プロモーション {index}/{total}',
  adSkipPromo: 'プロモーションをスキップ',
} satisfies AdsMessages;
