/**
 * The words of the diagnostics panel's frame, by id, merged into the
 * player's `Messages` so one `addLocale` call carries them. The report
 * itself stays in English: it goes to the people who read engine traces.
 * Each id lists its English text, which the element carries itself. Type
 * only.
 */
export interface DiagnosticsMessages {
  /** "Diagnostics": the button that opens the panel, and the panel. */
  readonly diagnostics: string;
  /** "Copy report". */
  readonly diagnosticsCopy: string;
  /** "Copied". */
  readonly diagnosticsCopied: string;
  /** "Close": the panel's close button. */
  readonly diagnosticsClose: string;
}

declare module '@mattebox/player' {
  interface Messages extends DiagnosticsMessages {}
}
