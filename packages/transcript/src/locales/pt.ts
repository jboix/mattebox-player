/**
 * Portuguese words of the transcript, for `MatteboxPlayerElement.addLocale('pt', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { TranscriptMessages } from '../messages.js';

export default {
  transcript: 'Transcrição',
  transcriptClose: 'Fechar',
  transcriptLanguage: 'Idioma',
  transcriptSubtitles: 'Legendas',
  transcriptNone: 'Nenhum',
  transcriptTrack: 'Faixa',
  transcriptSearch: 'Pesquisar',
  transcriptPrevious: 'Resultado anterior',
  transcriptNext: 'Resultado seguinte',
  transcriptCount: '{at} de {count}',
  transcriptNoMatch: 'Sem resultados',
  transcriptSearchFailed: 'A pesquisa não está disponível',
  transcriptBlocked: 'Esta parte não está disponível',
  transcriptRange: '{start} a {end}',
  transcriptMore: 'Carregar mais linhas',
  transcriptLoading: 'A carregar mais linhas',
  transcriptPartial: 'A carregar mais linhas. A pesquisa abrange as linhas já carregadas.',
  transcriptChoose: 'Escolha um idioma para ler a transcrição.',
  transcriptEmpty: 'Este idioma não tem linhas.',
} satisfies TranscriptMessages;
