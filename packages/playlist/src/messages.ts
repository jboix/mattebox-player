/**
 * The words of the playlist's elements, by id, merged into the player's
 * `Messages` so one `addLocale` call carries them. Each id lists its
 * English text, which the elements carry themselves. Type only.
 */
export interface PlaylistMessages {
  /** "Playlist": the list's heading and the button that opens it. */
  readonly playlist: string;
  /** "Previous". */
  readonly playlistPrevious: string;
  /** "Next". */
  readonly playlistNext: string;
  /** "Close": the list's close button. */
  readonly playlistClose: string;
  /** "Shuffle". */
  readonly playlistShuffle: string;
  /** "Repeat all". */
  readonly playlistRepeatAll: string;
  /** "Repeat one". */
  readonly playlistRepeatOne: string;
  /** "Repeat off". */
  readonly playlistRepeatOff: string;
  /** "Up next": the end card's heading. */
  readonly upNext: string;
  /** "Next episode": the end card's play button. */
  readonly upNextPlay: string;
  /** "Close": the end card's dismiss button. */
  readonly upNextDismiss: string;
  /** "in {seconds} s": the end card's countdown. */
  readonly upNextCountdown: string;
}

declare module '@mattebox/player' {
  interface Messages extends PlaylistMessages {}
}
