/**
 * The words of the cast elements, by id, merged into the player's
 * `Messages` so one `addLocale` call carries them. The cast screen's play,
 * pause and seek use the player's own `play`, `pause` and `seek`. Each id
 * lists its English text, which the elements carry themselves. Type only.
 */
export interface CastMessages {
  /** "Cast": the cast button. */
  readonly castStart: string;
  /** "Stop casting". */
  readonly castStop: string;
  /** "Casting to {device}": the cast screen's title. */
  readonly castingTo: string;
}

declare module '@mattebox/player' {
  interface Messages extends CastMessages {}
}
