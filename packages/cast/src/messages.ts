/**
 * The words of the cast elements, by id, merged into the player's
 * `Messages` so one `addLocale` call carries them. Each id lists its
 * English text, which the elements carry themselves. Type only.
 */
export interface CastMessages {
  /** "Cast": the cast button. */
  readonly castStart: string;
  /** "Stop casting". */
  readonly castStop: string;
}

declare module '@mattebox/player' {
  interface Messages extends CastMessages {}
}
