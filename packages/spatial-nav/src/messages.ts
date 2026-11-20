/**
 * The words of the controls bubble, by id, merged into the player's
 * `Messages` so one `addLocale` call carries them. Each id lists its
 * English text, which the bubble carries itself. Type only.
 */
export interface GamepadMessages {
  /** "Controller": the name of the bubble. */
  readonly gamepadController: string;
  /** "Move": the stick and the pad's arrows. */
  readonly gamepadMove: string;
  /** "Select". */
  readonly gamepadSelect: string;
  /** "Back". */
  readonly gamepadBack: string;
  /** "Play or pause". */
  readonly gamepadPlayPause: string;
  /** "Rewind". */
  readonly gamepadRewind: string;
  /** "Fast forward". */
  readonly gamepadFastForward: string;
  /** "Previous". */
  readonly gamepadPrevious: string;
  /** "Next". */
  readonly gamepadNext: string;
  /** "Subtitles". */
  readonly gamepadSubtitles: string;
  /** "Mute". */
  readonly gamepadMute: string;
  /** "Fullscreen". */
  readonly gamepadFullscreen: string;
  /** "Controls": the button that opens and closes the bubble. */
  readonly gamepadControls: string;
  /** "Cross": the ✕ button of a PlayStation pad, said by a screen reader. */
  readonly gamepadCross: string;
  /** "Circle": the ○ button. */
  readonly gamepadCircle: string;
  /** "Square": the □ button. */
  readonly gamepadSquare: string;
  /** "Triangle": the △ button. */
  readonly gamepadTriangle: string;
}

declare module '@mattebox/player' {
  interface Messages extends GamepadMessages {}
}
