/**
 * The extension table. Small and explicit: an unknown extension leaves the
 * type undefined, and an undefined type reaches every handler as `maybe`.
 * No HEAD requests.
 */
const TYPES: Readonly<Record<string, string>> = {
  m3u8: 'application/vnd.apple.mpegurl',
  mpd: 'application/dash+xml',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
};

/** The MIME type the URL's extension implies, or undefined. The query and fragment are ignored. */
export function inferType(url: string): string | undefined {
  let path = url;
  try {
    path = new URL(url, 'http://localhost/').pathname;
  } catch {
    // Not a URL: the last path segment of the string decides.
  }
  const file = path.slice(path.lastIndexOf('/') + 1);
  const dot = file.lastIndexOf('.');
  if (dot === -1) return undefined;
  return TYPES[file.slice(dot + 1).toLowerCase()];
}
