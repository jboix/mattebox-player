/**
 * Hindi words of the live captions, for `MatteboxPlayerElement.addLocale('hi', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { LiveCaptionsMessages } from '../messages.js';

export default {
  liveCaptionsPreparing: 'लाइव कैप्शन तैयार हो रहे हैं',
  liveCaptionsLanguage: 'इस भाषा में लाइव कैप्शन उपलब्ध नहीं हैं',
  liveCaptionsDownload: 'लाइव कैप्शन डाउनलोड नहीं हो सके',
  liveCaptionsError: 'लाइव कैप्शन रुक गए',
  liveCaptionsSource: 'लाइव कैप्शन इस वीडियो को नहीं सुन सकते',
} satisfies LiveCaptionsMessages;
