/**
 * The words of the 360 package, by id, merged into the player's `Messages`
 * so one `addLocale` call carries them. Each id lists its English text,
 * which the elements carry themselves. Type only.
 */
export interface Player360Messages {
  /** "Enter VR": the headset button, while the view shows on the screen. */
  readonly enterVr: string;
  /** "Exit VR": the headset button, while a headset shows the view. */
  readonly exitVr: string;
  /** "Turn with the device": the toggle for the device's motion, pressed while it turns the view. */
  readonly deviceMotion: string;
}

declare module '@mattebox/player' {
  interface Messages extends Player360Messages {}
}
