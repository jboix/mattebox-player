/**
 * Catalan words of the live captions, for `MatteboxPlayerElement.addLocale('ca', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { LiveCaptionsMessages } from '../messages.js';

export default {
  liveCaptionsPreparing: 'Preparant els subtítols en directe',
  liveCaptionsLanguage: 'Els subtítols en directe no estan disponibles en aquest idioma',
  liveCaptionsDownload: "No s'han pogut baixar els subtítols en directe",
  liveCaptionsError: "Els subtítols en directe s'han aturat",
  liveCaptionsSource: 'Els subtítols en directe no poden escoltar aquest vídeo',
} satisfies LiveCaptionsMessages;
