/**
 * The words of the live captions, by id, merged into the player's
 * `Messages` so one `addLocale` call carries them. Each id lists its
 * English text, which the elements carry themselves. Type only.
 */
export interface LiveCaptionsMessages {
  /** "Preparing live captions": while the language downloads. */
  readonly liveCaptionsPreparing: string;
  /** "Live captions are not available in this language". */
  readonly liveCaptionsLanguage: string;
  /** "Live captions could not be downloaded". */
  readonly liveCaptionsDownload: string;
  /** "Live captions stopped": any other failure. */
  readonly liveCaptionsError: string;
  /** "Live captions cannot listen to this video": another site's media, served without CORS, which the browser does not let a page capture. */
  readonly liveCaptionsSource: string;
}

declare module '@mattebox/player' {
  interface Messages extends LiveCaptionsMessages {}
}
