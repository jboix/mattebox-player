/**
 * German words of the live captions, for `MatteboxPlayerElement.addLocale('de', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { LiveCaptionsMessages } from '../messages.js';

export default {
  liveCaptionsPreparing: 'Live-Untertitel werden vorbereitet',
  liveCaptionsLanguage: 'Live-Untertitel sind in dieser Sprache nicht verfügbar',
  liveCaptionsDownload: 'Live-Untertitel konnten nicht heruntergeladen werden',
  liveCaptionsError: 'Live-Untertitel wurden beendet',
  liveCaptionsSource: 'Live-Untertitel können dieses Video nicht hören',
} satisfies LiveCaptionsMessages;
