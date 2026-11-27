/**
 * `@mattebox/player-transcript`: the subtitles of a programme as a list of
 * lines in a panel over the player, with a search.
 *
 * Importing it registers `<mbx-transcript>` and `<mbx-transcript-button>`.
 * The lines come from the engine's `transcript` stage, which `transcript()`
 * adds to every player: `MatteboxPlayerElement.define({ addons:
 * [transcript()] })`.
 */
import type { PlayerAddon } from '@mattebox/player';
import stage from 'mattebox/stages/transcript';
import { MbxTranscriptButton } from './buttons.js';
import { MbxTranscript } from './panel.js';

export { MbxTranscriptButton } from './buttons.js';
export type { TranscriptMessages } from './messages.js';
export { MbxTranscript } from './panel.js';
export type { SearchContext, TranscriptMatch, TranscriptSearch } from './search.js';

/** What `transcript()` takes. */
export interface TranscriptOptions {
  /**
   * Prefers the engine to Safari's own HLS where MediaSource plays the
   * source, because Safari's own HLS gives the page no text track to read.
   * Off by default: the panel is then hidden where Safari plays HLS itself.
   */
  readonly engine?: boolean;
}

/** The add-on: pass it in `addons`. It adds the stage that reads the lines. */
export function transcript(options: TranscriptOptions = {}): PlayerAddon {
  return {
    name: 'transcript',
    stages: () => [stage()],
    ...(options.engine === true ? { engine: true } : {}),
  };
}

const ELEMENTS: ReadonlyArray<readonly [string, CustomElementConstructor]> = [
  ['mbx-transcript', MbxTranscript],
  ['mbx-transcript-button', MbxTranscriptButton],
];
for (const [name, element] of ELEMENTS) {
  if (customElements.get(name) === undefined) customElements.define(name, element);
}

declare global {
  interface HTMLElementTagNameMap {
    'mbx-transcript': MbxTranscript;
    'mbx-transcript-button': MbxTranscriptButton;
  }
}
