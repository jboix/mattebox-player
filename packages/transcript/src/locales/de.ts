/**
 * German words of the transcript, for `MatteboxPlayerElement.addLocale('de', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { TranscriptMessages } from '../messages.js';

export default {
  transcript: 'Transkript',
  transcriptClose: 'Schließen',
  transcriptLanguage: 'Sprache',
  transcriptSubtitles: 'Untertitel',
  transcriptNone: 'Keine',
  transcriptTrack: 'Spur',
  transcriptSearch: 'Suchen',
  transcriptPrevious: 'Vorheriger Treffer',
  transcriptNext: 'Nächster Treffer',
  transcriptCount: '{at} von {count}',
  transcriptNoMatch: 'Kein Treffer',
  transcriptSearchFailed: 'Die Suche ist nicht verfügbar',
  transcriptBlocked: 'Dieser Teil ist nicht verfügbar',
  transcriptRange: '{start} bis {end}',
  transcriptMore: 'Weitere Zeilen laden',
  transcriptLoading: 'Weitere Zeilen werden geladen',
  transcriptPartial:
    'Weitere Zeilen werden geladen. Die Suche umfasst die bereits geladenen Zeilen.',
  transcriptChoose: 'Wähle eine Sprache, um das Transkript zu lesen.',
  transcriptEmpty: 'Diese Sprache hat keine Zeilen.',
} satisfies TranscriptMessages;
