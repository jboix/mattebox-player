/**
 * The transcript's glyphs, on the player's 32-unit grid. They are drawn by
 * script, so nothing here parses markup.
 */

export type IconName = 'transcript' | 'close' | 'up' | 'down' | 'blocked';

const PATHS: Readonly<Record<IconName, string>> = {
  transcript: 'M5 7h22v2.5H5zM5 12.5h22V15H5zM5 18h22v2.5H5zM5 23.5h14V26H5z',
  close:
    'M16 17.98L9.21 24.77L7.23 22.79L14.02 16L7.23 9.21L9.21 7.23L16 14.02L22.79 7.23L24.77 9.21L17.98 16L24.77 22.79L22.79 24.77z',
  up: 'M16 10.5L25 19.5L23.02 21.48L16 14.46L8.98 21.48L7 19.5z',
  down: 'M16 21.5L7 12.5L8.98 10.52L16 17.54L23.02 10.52L25 12.5z',
  blocked:
    'M16 5A11 11 0 1 0 16 27A11 11 0 0 0 16 5zM16 7.5A8.5 8.5 0 0 1 22.9 20.97L11.03 9.1A8.46 8.46 0 0 1 16 7.5zM9.1 11.03L20.97 22.9A8.5 8.5 0 0 1 9.1 11.03z',
};

const SVG = 'http://www.w3.org/2000/svg';

/** The glyph `name`, sized by its stylesheet and hidden from a screen reader. */
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
