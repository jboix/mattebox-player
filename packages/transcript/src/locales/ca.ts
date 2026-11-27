/**
 * Catalan words of the transcript, for `MatteboxPlayerElement.addLocale('ca', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { TranscriptMessages } from '../messages.js';

export default {
  transcript: 'Transcripció',
  transcriptClose: 'Tanca',
  transcriptLanguage: 'Idioma',
  transcriptSubtitles: 'Subtítols',
  transcriptNone: 'Cap',
  transcriptTrack: 'Pista',
  transcriptSearch: 'Cerca',
  transcriptPrevious: 'Resultat anterior',
  transcriptNext: 'Resultat següent',
  transcriptCount: '{at} de {count}',
  transcriptNoMatch: 'Cap resultat',
  transcriptSearchFailed: 'La cerca no està disponible',
  transcriptBlocked: 'Aquesta part no està disponible',
  transcriptRange: '{start} a {end}',
  transcriptMore: 'Carrega més línies',
  transcriptLoading: 'S’estan carregant més línies',
  transcriptPartial: 'S’estan carregant més línies. La cerca cobreix les línies ja carregades.',
  transcriptChoose: 'Tria un idioma per llegir la transcripció.',
  transcriptEmpty: 'Aquest idioma no té cap línia.',
} satisfies TranscriptMessages;
