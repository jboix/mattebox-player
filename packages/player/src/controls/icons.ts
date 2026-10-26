/**
 * The glyphs, Mattebox's own drawings: filled paths on a 32-unit viewBox,
 * one visual weight across the set, with hard corners and 45 degree cuts
 * like the panels of the mark. Each is one path, so a glyph scales to any
 * size and takes the text colour.
 */

export type IconName =
  | 'play'
  | 'pause'
  | 'replay'
  | 'mute'
  | 'volume-low'
  | 'volume-high'
  | 'fullscreen'
  | 'fullscreen-exit'
  | 'quality'
  | 'audio'
  | 'video'
  | 'subtitles'
  | 'subtitles-on'
  | 'lock-closed'
  | 'seek-backward'
  | 'seek-forward'
  | 'seek-backward-5'
  | 'seek-forward-5'
  | 'seek-backward-10'
  | 'seek-forward-10'
  | 'seek-backward-15'
  | 'seek-forward-15'
  | 'seek-backward-30'
  | 'seek-forward-30'
  | 'playback-speed'
  | 'picture-in-picture'
  | 'picture-in-picture-exit'
  | 'airplay'
  | 'airplay-active'
  | 'chapters'
  | 'fast-forward'
  | 'fast-backward'
  | 'audio-description'
  | 'sdh'
  | 'closed-captions'
  | 'text-size'
  | 'text-background';

/**
 * Each glyph's subpaths joined into one `d`. The path is drawn even-odd:
 * a frame, a ring or a letter cuts its hole with a nested subpath, and no
 * two filled subpaths overlap.
 */
const PATHS: Readonly<Record<IconName, string>> = {
  play: 'M9 5L26 16L9 27z',
  pause: 'M8 6h5.5v20h-5.5zM18.5 6h5.5v20h-5.5z',
  replay:
    'M16 6.75A10.25 10.25 0 1 1 7.12 11.88L9.29 13.12A7.75 7.75 0 1 0 16 9.25zM16 3.5L16 12.5L10 8z',
  mute: 'M4 12L9 12L16 6L16 26L9 20L4 20zM24 17.77L20.99 20.77L19.23 19.01L22.23 16L19.23 12.99L20.99 11.23L24 14.23L27.01 11.23L28.77 12.99L25.77 16L28.77 19.01L27.01 20.77z',
  'volume-low':
    'M4 12L9 12L16 6L16 26L9 20L4 20zM21.13 10.87A7.25 7.25 0 0 1 21.13 21.13L19.36 19.36A4.75 4.75 0 0 0 19.36 12.64z',
  'volume-high':
    'M4 12L9 12L16 6L16 26L9 20L4 20zM21.13 10.87A7.25 7.25 0 0 1 21.13 21.13L19.36 19.36A4.75 4.75 0 0 0 19.36 12.64zM24.31 7.69A11.75 11.75 0 0 1 24.31 24.31L22.54 22.54A9.25 9.25 0 0 0 22.54 9.46z',
  fullscreen:
    'M5 5L14 5L11 8L8 8L8 11L5 14zM18 5L27 5L27 14L24 11L24 8L21 8zM5 18L8 21L8 24L11 24L14 27L5 27zM27 18L27 27L18 27L21 24L24 24L24 21z',
  'fullscreen-exit':
    'M13 4L13 13L4 13L7 10L10 10L10 7zM19 4L22 7L22 10L25 10L28 13L19 13zM4 19L13 19L13 28L10 25L10 22L7 22zM19 19L28 19L25 22L22 22L22 25L19 28z',
  quality:
    'M5 22L10 18.1L10 27L5 27zM13.5 15.4L18.5 11.6L18.5 27L13.5 27zM22 8.9L27 5L27 27L22 27z',
  audio:
    'M4.75 13h2.5v6h-2.5zM9.75 9h2.5v14h-2.5zM14.75 5h2.5v22h-2.5zM19.75 10.5h2.5v11h-2.5zM24.75 13.5h2.5v5h-2.5z',
  // A camera: the body as a frame, the lens solid.
  video: 'M4 9h16v14H4zM6.5 11.5h11v9h-11zM21 14l7-4v12l-7-4z',
  subtitles:
    'M4 6h20l4 4v16H4zM6.5 8.5H22.96L25.5 11.04V23.5H6.5zM9 14h8v2.5h-8zM19 14h4v2.5h-4zM9 18.5h4v2.5h-4zM15 18.5h8v2.5h-8z',
  'subtitles-on':
    'M4 6h20l4 4v16H4zM9 14h8v2.5h-8zM19 14h4v2.5h-4zM9 18.5h4v2.5h-4zM15 18.5h8v2.5h-8z',
  'lock-closed':
    'M7 14h18v13H7zM14.75 18.5v4.5h2.5v-4.5zM9.75 14V11A6.25 6.25 0 0 1 22.25 11V14H19.75V11A3.75 3.75 0 0 0 12.25 11V14z',
  'seek-backward':
    'M16 6.75A10.25 10.25 0 1 1 7.12 11.88L9.29 13.12A7.75 7.75 0 1 0 16 9.25zM16 3.5L16 12.5L10 8z',
  'seek-forward':
    'M24.88 11.88A10.25 10.25 0 1 1 16 6.75L16 9.25A7.75 7.75 0 1 0 22.71 13.12zM16 3.5L22 8L16 12.5z',
  'seek-backward-5':
    'M16 6.75A10.25 10.25 0 1 1 7.12 11.88L9.29 13.12A7.75 7.75 0 1 0 16 9.25zM16 3.5L16 12.5L10 8zM13 13.5h6v2h-6zM13 15.5h2v0.5h-2zM13 16h6v2h-6zM17 18h2v0.5h-2zM13 18.5h6v2h-6z',
  'seek-forward-5':
    'M24.88 11.88A10.25 10.25 0 1 1 16 6.75L16 9.25A7.75 7.75 0 1 0 22.71 13.12zM16 3.5L22 8L16 12.5zM13 13.5h6v2h-6zM13 15.5h2v0.5h-2zM13 16h6v2h-6zM17 18h2v0.5h-2zM13 18.5h6v2h-6z',
  'seek-backward-10':
    'M16 6.75A10.25 10.25 0 1 1 7.12 11.88L9.29 13.12A7.75 7.75 0 1 0 16 9.25zM16 3.5L16 12.5L10 8zM11.5 13.5h2.2v7h-2.2zM15.5 13.5h5.5v7h-5.5zM17.6 15.6v2.8h1.3v-2.8z',
  'seek-forward-10':
    'M24.88 11.88A10.25 10.25 0 1 1 16 6.75L16 9.25A7.75 7.75 0 1 0 22.71 13.12zM16 3.5L22 8L16 12.5zM11.5 13.5h2.2v7h-2.2zM15.5 13.5h5.5v7h-5.5zM17.6 15.6v2.8h1.3v-2.8z',
  'seek-backward-15':
    'M16 6.75A10.25 10.25 0 1 1 7.12 11.88L9.29 13.12A7.75 7.75 0 1 0 16 9.25zM16 3.5L16 12.5L10 8zM10.5 13.5h2.2v7h-2.2zM14.7 13.5h5.8v2h-5.8zM14.7 15.5h2v0.5h-2zM14.7 16h5.8v2h-5.8zM18.5 18h2v0.5h-2zM14.7 18.5h5.8v2h-5.8z',
  'seek-forward-15':
    'M24.88 11.88A10.25 10.25 0 1 1 16 6.75L16 9.25A7.75 7.75 0 1 0 22.71 13.12zM16 3.5L22 8L16 12.5zM10.5 13.5h2.2v7h-2.2zM14.7 13.5h5.8v2h-5.8zM14.7 15.5h2v0.5h-2zM14.7 16h5.8v2h-5.8zM18.5 18h2v0.5h-2zM14.7 18.5h5.8v2h-5.8z',
  'seek-backward-30':
    'M16 6.75A10.25 10.25 0 1 1 7.12 11.88L9.29 13.12A7.75 7.75 0 1 0 16 9.25zM16 3.5L16 12.5L10 8zM13 13.5h2v7h-2zM10 13.5h3v2h-3zM11 16h2v2h-2zM10 18.5h3v2h-3zM16.5 13.5h5.5v7h-5.5zM18.6 15.6v2.8h1.3v-2.8z',
  'seek-forward-30':
    'M24.88 11.88A10.25 10.25 0 1 1 16 6.75L16 9.25A7.75 7.75 0 1 0 22.71 13.12zM16 3.5L22 8L16 12.5zM13 13.5h2v7h-2zM10 13.5h3v2h-3zM11 16h2v2h-2zM10 18.5h3v2h-3zM16.5 13.5h5.5v7h-5.5zM18.6 15.6v2.8h1.3v-2.8z',
  'playback-speed':
    'M7.69 26.31A11.75 11.75 0 1 1 24.31 26.31L22.54 24.54A9.25 9.25 0 1 0 9.46 24.54zM16.41 20.31L21.14 11.87L13.66 17.99z',
  'picture-in-picture': 'M4 6h24v20H4zM6.5 8.5v15h19v-15zM15 15h8v6h-8z',
  'picture-in-picture-exit':
    'M4 6h24v20H4zM6.5 8.5v15h19v-15zM9.5 11.5L16 11.5L9.5 18zM13.63 13.87L19.29 19.52L17.52 21.29L11.87 15.63z',
  airplay: 'M4 6H28V23.25H23V20.75H25.5V8.5H6.5V20.75H9V23.25H4zM16 17.5L23.5 27L8.5 27z',
  'airplay-active': 'M4 6H28V23.25H22.1L16 15.5L9.9 23.25H4zM16 17.5L23.5 27L8.5 27z',
  chapters:
    'M5 6.5h4v4h-4zM12 7.25h15v2.5h-15zM5 14h4v4h-4zM12 14.75h15v2.5h-15zM5 21.5h4v4h-4zM12 22.25h15v2.5h-15z',
  'fast-forward': 'M4 7L15 16L4 25zM16 7L27 16L16 25z',
  'fast-backward': 'M28 7L17 16L28 25zM16 7L5 16L16 25z',
  'audio-description':
    'M1.5 23L4.8 9h2.6L10.7 23H8.4l-.75-3.2H4.55L3.8 23zM5.1 17.4h2L6.1 12.9zM12.2 9h2.8a7 7 0 0 1 0 14h-2.8zM14.6 11.4v9.2h.4a4.6 4.6 0 0 0 0-9.2zM24.2 9.96A9.4 9.4 0 0 1 24.2 22.04L22.82 20.89A7.6 7.6 0 0 0 22.82 11.11zM27.11 7.52A13.2 13.2 0 0 1 27.11 24.48L25.73 23.33A11.4 11.4 0 0 0 25.73 8.67z',
  sdh: 'M9.7 13.2L10.3 10.4L11.6 8.5L13.6 7.2L16 6.8L18.7 7.3L20.8 8.6L22.2 10.6L22.7 13L22.5 14.9L21.8 16.3L20.8 17.5L19.6 18.7L18.5 19.9L17.9 21.3L17.5 22.5L17.1 23.5L16.7 24.5L16 25.2L15.2 25.6L14.3 25.7L13.3 25.6L12.6 25.1L12 24.4L11.7 23.4L9.3 24.2L9.8 25.7L10.9 27L12.5 27.9L14.3 28.3L16 28L17.6 27.2L18.7 26L19.5 24.5L19.8 23.3L20.2 22.2L20.6 21.3L21.4 20.3L22.6 19.2L23.9 17.7L24.9 15.7L25.3 13L24.6 9.5L22.6 6.7L19.6 4.9L16 4.2L12.7 4.9L9.9 6.6L7.9 9.4L7.3 12.8zM13.7 13.2L13.9 12.1L14.4 11.4L15.1 10.9L16 10.8L16.9 10.9L17.6 11.4L18.1 12.1L18.3 13.2L20.7 12.8L20.4 11.1L19.4 9.6L17.9 8.6L16 8.2L14.1 8.6L12.6 9.6L11.6 11.1L11.3 12.8z',
  'closed-captions':
    'M14.24 20.24A6 6 0 1 1 14.24 11.76L12.47 13.53A3.5 3.5 0 1 0 12.47 18.47zM26.24 20.24A6 6 0 1 1 26.24 11.76L24.47 13.53A3.5 3.5 0 1 0 24.47 18.47z',
  'text-size':
    'M2.5 23L5.9 13L8.1 13L11.5 23zM7 16.53L7.64 18.4L6.36 18.4zM5.65 20.5L8.35 20.5L9.2 23L4.8 23zM12.5 23L19.5 6L22.5 6L29.5 23zM21 9.64L23.45 15.6L18.55 15.6zM17.48 18.2L24.52 18.2L26.5 23L15.5 23z',
  'text-background':
    'M4 6h24v20h-24zM9 22.5L14.6 9.5L17.4 9.5L23 22.5zM16 12.75L17.66 16.6L14.34 16.6zM13.35 18.9L18.65 18.9L20.2 22.5L11.8 22.5z',
};

const SVG = 'http://www.w3.org/2000/svg';

/** A glyph, hidden from the accessibility tree: the button it sits in carries the name. */
export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('part', 'icon');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('fill-rule', 'evenodd');
  path.setAttribute('d', PATHS[name]);
  svg.append(path);
  return svg;
}
