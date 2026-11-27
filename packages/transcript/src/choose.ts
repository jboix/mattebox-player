/**
 * Which language a transcript opens in. Pure: no DOM.
 *
 * In order: the subtitles that show, the player's language, the viewer's
 * languages, and no language. The viewer picks another in the panel.
 */

/** A text track the transcript can read. */
export interface Choice {
  readonly id: string;
  /** The track's language tag, as its manifest states it. */
  readonly lang?: string;
}

/** The language of a tag, without region or script: `pt-BR` gives `pt`. */
function base(tag: string): string {
  return (tag.split(/[-_]/)[0] ?? '').toLowerCase();
}

/**
 * The track to show: `showing` when the transcript can read it, else the
 * first track in one of `languages`, taken in their order. Null when none
 * applies.
 */
export function choose(
  tracks: readonly Choice[],
  showing: string | null,
  languages: readonly string[],
): string | null {
  if (showing !== null && tracks.some((track) => track.id === showing)) return showing;
  for (const language of languages) {
    if (language === '') continue;
    const exact = tracks.find((track) => track.lang?.toLowerCase() === language.toLowerCase());
    const close = tracks.find(
      (track) => track.lang !== undefined && base(track.lang) === base(language),
    );
    const found = exact ?? close;
    if (found !== undefined) return found.id;
  }
  return null;
}
