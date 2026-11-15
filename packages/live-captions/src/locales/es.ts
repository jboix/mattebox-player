/**
 * Spanish words of the live captions, for `MatteboxPlayerElement.addLocale('es', …)`.
 * Machine-drafted, not yet reviewed by a native speaker.
 */
import type { LiveCaptionsMessages } from '../messages.js';

export default {
  liveCaptionsPreparing: 'Preparando los subtítulos en directo',
  liveCaptionsLanguage: 'Los subtítulos en directo no están disponibles en este idioma',
  liveCaptionsDownload: 'No se han podido descargar los subtítulos en directo',
  liveCaptionsError: 'Los subtítulos en directo se han detenido',
  liveCaptionsSource: 'Los subtítulos en directo no pueden escuchar este vídeo',
} satisfies LiveCaptionsMessages;
