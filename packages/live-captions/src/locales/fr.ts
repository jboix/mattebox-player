/**
 * French words of the live captions, for `MatteboxPlayerElement.addLocale('fr', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { LiveCaptionsMessages } from '../messages.js';

export default {
  liveCaptionsPreparing: 'Préparation des sous-titres en direct',
  liveCaptionsLanguage: 'Les sous-titres en direct ne sont pas disponibles dans cette langue',
  liveCaptionsDownload: 'Impossible de télécharger les sous-titres en direct',
  liveCaptionsError: 'Les sous-titres en direct se sont arrêtés',
  liveCaptionsSource: 'Les sous-titres en direct ne peuvent pas écouter cette vidéo',
} satisfies LiveCaptionsMessages;
