/**
 * Italian words of the transcript, for `MatteboxPlayerElement.addLocale('it', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { TranscriptMessages } from '../messages.js';

export default {
  transcript: 'Trascrizione',
  transcriptClose: 'Chiudi',
  transcriptLanguage: 'Lingua',
  transcriptSubtitles: 'Sottotitoli',
  transcriptNone: 'Nessuna',
  transcriptTrack: 'Traccia',
  transcriptSearch: 'Cerca',
  transcriptPrevious: 'Risultato precedente',
  transcriptNext: 'Risultato successivo',
  transcriptCount: '{at} di {count}',
  transcriptNoMatch: 'Nessun risultato',
  transcriptSearchFailed: 'La ricerca non è disponibile',
  transcriptBlocked: 'Questa parte non è disponibile',
  transcriptRange: 'da {start} a {end}',
  transcriptMore: 'Carica altre righe',
  transcriptLoading: 'Caricamento di altre righe',
  transcriptPartial: 'Caricamento di altre righe. La ricerca copre le righe già caricate.',
  transcriptChoose: 'Scegli una lingua per leggere la trascrizione.',
  transcriptEmpty: 'Questa lingua non ha righe.',
} satisfies TranscriptMessages;
