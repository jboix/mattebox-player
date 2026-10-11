/**
 * The playlist glyphs, Mattebox's own drawings in the player's style:
 * filled paths on a 32-unit viewBox, one visual weight across the set.
 */

export type IconName = 'playlist' | 'next' | 'previous' | 'shuffle' | 'repeat' | 'close';

const PATHS: Readonly<Record<IconName, string>> = {
  playlist: 'M4 13h24v14H4zM13.5 16v8l6.5-4zM7 8.5h18v2.5h-18zM10 4h12v2.5h-12z',
  next: 'M6 6L21 16L6 26zM22.5 6h3.5v20h-3.5z',
  previous: 'M26 6L11 16L26 26zM6 6h3.5v20h-3.5z',
  shuffle:
    'M4 11.25L8.41 11.25L18.41 23.25L24 23.25L24 20.75L19.59 20.75L9.59 8.75L4 8.75zM4 23.25L9.58 23.25L12.56 19.7L10.64 18.1L8.42 20.75L4 20.75zM17.36 13.9L19.58 11.25L24 11.25L24 8.75L18.42 8.75L15.44 12.3zM24 6L28.5 10L24 14zM24 18L28.5 22L24 26z',
  repeat:
    'M7.25 15L7.25 10.5L22 10.5L22 8L4.75 8L4.75 15zM22 5L27 9.25L22 13.5zM24.75 17L24.75 21.5L10 21.5L10 24L27.25 24L27.25 17zM10 18.5L10 27L5 22.75z',
  close:
    'M16 17.98L9.21 24.77L7.23 22.79L14.02 16L7.23 9.21L9.21 7.23L16 14.02L22.79 7.23L24.77 9.21L17.98 16L24.77 22.79L22.79 24.77z',
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
