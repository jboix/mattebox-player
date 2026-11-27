/**
 * Hindi words of the transcript, for `MatteboxPlayerElement.addLocale('hi', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { TranscriptMessages } from '../messages.js';

export default {
  transcript: 'प्रतिलेख',
  transcriptClose: 'बंद करें',
  transcriptLanguage: 'भाषा',
  transcriptSubtitles: 'उपशीर्षक',
  transcriptNone: 'कोई नहीं',
  transcriptTrack: 'ट्रैक',
  transcriptSearch: 'खोजें',
  transcriptPrevious: 'पिछला परिणाम',
  transcriptNext: 'अगला परिणाम',
  transcriptCount: '{count} में से {at}',
  transcriptNoMatch: 'कोई परिणाम नहीं',
  transcriptSearchFailed: 'खोज उपलब्ध नहीं है',
  transcriptBlocked: 'यह भाग उपलब्ध नहीं है',
  transcriptRange: '{start} से {end}',
  transcriptMore: 'और पंक्तियाँ लोड करें',
  transcriptLoading: 'और पंक्तियाँ लोड हो रही हैं',
  transcriptPartial: 'और पंक्तियाँ लोड हो रही हैं। खोज अब तक लोड हुई पंक्तियों में होती है।',
  transcriptChoose: 'प्रतिलेख पढ़ने के लिए भाषा चुनें।',
  transcriptEmpty: 'इस भाषा में कोई पंक्ति नहीं है।',
} satisfies TranscriptMessages;
