/**
 * The words of the ad elements, by id, merged into the player's `Messages`
 * so one `addLocale` call carries them. Each id lists its English text,
 * which the elements carry themselves. Type only.
 */
export interface AdsMessages {
  /** "Ad": the label of a break with one ad. */
  readonly adLabel: string;
  /** "Ad {index} of {total}": the label of a pod. */
  readonly adCount: string;
  /** "Skip ad". */
  readonly adSkip: string;
  /** "Skip in {seconds}": the skip button before the ad may be skipped. */
  readonly adSkipIn: string;
  /** "Learn more": the link to the advertiser's page. */
  readonly adLearnMore: string;
  /** "Ad break, {seconds} seconds": said to a screen reader when a break starts. */
  readonly adBreak: string;
  /** "Promo": the label of a promotion. */
  readonly adPromo: string;
  /** "Promo {index} of {total}". */
  readonly adPromoCount: string;
  /** "Skip promo". */
  readonly adSkipPromo: string;
}

declare module '@mattebox/player' {
  interface Messages extends AdsMessages {}
}
