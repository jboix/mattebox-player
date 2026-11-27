/**
 * Japanese words of the transcript, for `MatteboxPlayerElement.addLocale('ja', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { TranscriptMessages } from '../messages.js';

export default {
  transcript: '文字起こし',
  transcriptClose: '閉じる',
  transcriptLanguage: '言語',
  transcriptSubtitles: '字幕',
  transcriptNone: 'なし',
  transcriptTrack: 'トラック',
  transcriptSearch: '検索',
  transcriptPrevious: '前の結果',
  transcriptNext: '次の結果',
  transcriptCount: '{at} / {count}',
  transcriptNoMatch: '結果なし',
  transcriptSearchFailed: '検索は利用できません',
  transcriptBlocked: 'この部分は利用できません',
  transcriptRange: '{start} ～ {end}',
  transcriptMore: 'さらに読み込む',
  transcriptLoading: '読み込み中',
  transcriptPartial: '読み込み中です。検索の対象は読み込み済みの行です。',
  transcriptChoose: '文字起こしを読む言語を選んでください。',
  transcriptEmpty: 'この言語には行がありません。',
} satisfies TranscriptMessages;
