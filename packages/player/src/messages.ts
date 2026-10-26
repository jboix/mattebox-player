/**
 * The words of the player, by id. A language is a set of them, which a
 * page registers with `MatteboxPlayerElement.addLocale`. Each id lists its
 * English text, which the controls carry themselves. A `{name}` in a text
 * is filled in at use. Type only: nothing here reaches a bundle.
 */
export interface PlayerMessages {
  /** "Play": the play button and the start button. */
  readonly play: string;
  /** "Pause". */
  readonly pause: string;
  /** "Replay", once the media has ended. */
  readonly replay: string;
  /** "Mute". */
  readonly mute: string;
  /** "Unmute". */
  readonly unmute: string;
  /** "Volume": the volume slider. */
  readonly volume: string;
  /** "Seek": the seek bar. */
  readonly seek: string;
  /** "{current} of {duration}": what the seek bar says at a time. */
  readonly seekOf: string;
  /** "{time} behind live". */
  readonly behindLive: string;
  /** "Not available": a blocked part of the seek bar. */
  readonly blocked: string;
  /** "Go to the live edge": the live button. */
  readonly goLive: string;
  /** "At the live edge". */
  readonly atLiveEdge: string;
  /** "LIVE": the live button's text. */
  readonly live: string;
  /** "Rewind": the backward scan button. */
  readonly rewind: string;
  /** "Fast forward". */
  readonly fastForward: string;
  /** "Back {seconds} seconds": the backward skip button. */
  readonly skipBack: string;
  /** "Forward {seconds} seconds". */
  readonly skipForward: string;
  /** "Enter fullscreen". */
  readonly enterFullscreen: string;
  /** "Exit fullscreen". */
  readonly exitFullscreen: string;
  /** "Picture in picture". */
  readonly enterPip: string;
  /** "Leave picture in picture". */
  readonly exitPip: string;
  /** "AirPlay". */
  readonly airplay: string;
  /** "Stop AirPlay". */
  readonly stopAirplay: string;
  /** "Loading": the spinner, and the live region after a wait. */
  readonly loading: string;
  /** "Playback failed": the error screen's title, and the live region. */
  readonly playbackFailed: string;
  /** "Retry". */
  readonly retry: string;
  /** "Back from {page}": the way back from a menu's page. */
  readonly menuBack: string;
  /** "Playback speed": the speed menu. */
  readonly speed: string;
  /** "Normal": the rate 1. */
  readonly speedNormal: string;
  /** "Chapters". */
  readonly chapters: string;
  /** "Quality". */
  readonly quality: string;
  /** "Auto": the quality the engine picks. */
  readonly qualityAuto: string;
  /** "Audio". */
  readonly audio: string;
  /** "Original": the badge of the original soundtrack. */
  readonly original: string;
  /** "AD": the badge of an audio description. */
  readonly audioDescription: string;
  /** "Mono". */
  readonly mono: string;
  /** "Stereo". */
  readonly stereo: string;
  /** "Track": "Track 2" names a track with no name or language. */
  readonly track: string;
  /** "Subtitles": the subtitles menu. */
  readonly subtitles: string;
  /** "Off": subtitles off. */
  readonly subtitlesOff: string;
  /** "SDH": the badge of subtitles for the deaf and hard of hearing. */
  readonly sdh: string;
  /** "CC": the badge of closed captions. */
  readonly closedCaptions: string;
  /** "Settings": the subtitle look. */
  readonly subtitleSettings: string;
  /** "Size". */
  readonly subtitleSize: string;
  /** "Small". */
  readonly sizeSmall: string;
  /** "Medium". */
  readonly sizeMedium: string;
  /** "Large". */
  readonly sizeLarge: string;
  /** "Extra large". */
  readonly sizeExtraLarge: string;
  /** "Background". */
  readonly subtitleBackground: string;
  /** "None": no background. */
  readonly backgroundNone: string;
  /** "Dark". */
  readonly backgroundDark: string;
  /** "Solid". */
  readonly backgroundSolid: string;
  /** "Video": the video menu. */
  readonly video: string;
  /** "Main": the main picture. */
  readonly videoMain: string;
  /** "Alternative": another version of the picture. */
  readonly videoAlternative: string;
  /** "Sign language". */
  readonly videoSign: string;
  /** "Captions": a version with captions in the picture. */
  readonly videoCaptions: string;
  /** "Subtitles": a version with subtitles in the picture. */
  readonly videoSubtitles: string;
  /** "Commentary". */
  readonly videoCommentary: string;
  /** "Skip": the marker button. */
  readonly skip: string;
  /** "Skip intro". */
  readonly skipIntro: string;
  /** "Skip credits". */
  readonly skipCredits: string;
  /** "Protected by {system}, {keys}": the DRM badge. */
  readonly drmProtected: string;
  /** "no key yet". */
  readonly drmNoKey: string;
  /** "{count} key: {statuses}". */
  readonly drmKey: string;
  /** "{count} keys: {statuses}". */
  readonly drmKeys: string;
  /** "Playing": the live region. */
  readonly saidPlaying: string;
  /** "Paused". */
  readonly saidPaused: string;
  /** "Audio: {track}". */
  readonly saidAudio: string;
  /** "Subtitles: {track}". */
  readonly saidSubtitles: string;
  /** "Subtitles off". */
  readonly saidSubtitlesOff: string;
}

/**
 * Every id a page can give words for. The player's ids are here; a
 * package with words of its own adds its ids through declaration merging:
 *
 * ```ts
 * declare module '@mattebox/player' {
 *   interface Messages extends PlaylistMessages {}
 * }
 * ```
 */
export interface Messages extends PlayerMessages {}

/** Some words of a language: a shipped one, or the page's own over it. */
export type Words = { readonly [Id in keyof Messages]?: string };
