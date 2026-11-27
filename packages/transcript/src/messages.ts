/**
 * The words the transcript shows, in English as the elements carry them. A
 * page changes them with `MatteboxPlayerElement.addLocale()` or with the
 * elements' `label` attributes.
 */

export interface TranscriptMessages {
  /** "Transcript": the panel's heading and the button's label. */
  readonly transcript: string;
  /** "Close". */
  readonly transcriptClose: string;
  /** "Language": the menu in the panel's header. */
  readonly transcriptLanguage: string;
  /** "Subtitles": beside the language the subtitles show in. */
  readonly transcriptSubtitles: string;
  /** "None": no language, so no lines. */
  readonly transcriptNone: string;
  /** "Track": a track without a name or a language, before its place. */
  readonly transcriptTrack: string;
  /** "Search". */
  readonly transcriptSearch: string;
  /** "Previous match". */
  readonly transcriptPrevious: string;
  /** "Next match". */
  readonly transcriptNext: string;
  /** "{at} of {count}": which match the viewer is at. */
  readonly transcriptCount: string;
  /** "No match". */
  readonly transcriptNoMatch: string;
  /** "Search is not available": the page's own search failed. */
  readonly transcriptSearchFailed: string;
  /** "This part is not available": a range that must not play. */
  readonly transcriptBlocked: string;
  /** "{start} to {end}": the times of such a range. */
  readonly transcriptRange: string;
  /** "Load more lines": a part that is not loaded. */
  readonly transcriptMore: string;
  /** "Loading more lines". */
  readonly transcriptLoading: string;
  /** "Loading more lines. A search covers the lines loaded so far." */
  readonly transcriptPartial: string;
  /** "Choose a language to read the transcript." */
  readonly transcriptChoose: string;
  /** "This language has no lines." */
  readonly transcriptEmpty: string;
}

declare module '@mattebox/player' {
  interface Messages extends TranscriptMessages {}
}
