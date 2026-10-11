/**
 * The play, pause and cast glyphs, Mattebox's own drawings and the same
 * ones the player draws: filled paths on a 32-unit viewBox. The cast glyph
 * is a screen with a corner open for three arcs, filled while casting.
 */

export type IconName = 'play' | 'pause' | 'cast' | 'cast-active';

/** Each glyph's subpaths joined into one `d`, drawn even-odd like the player's. */
const PATHS: Readonly<Record<IconName, string>> = {
  play: 'M9 5L26 16L9 27z',
  pause: 'M8 6h5.5v20h-5.5zM18.5 6h5.5v20h-5.5z',
  cast: 'M4 6H28V26H20V23.5H25.5V8.5H6.5V11H4zM4 23h3v3h-3zM4 17.5A8.5 8.5 0 0 1 12.5 26L10 26A6 6 0 0 0 4 20zM4 12A14 14 0 0 1 18 26L15.5 26A11.5 11.5 0 0 0 4 14.5z',
  'cast-active':
    'M4 6H28V26H20A16 16 0 0 0 4 10zM4 23h3v3h-3zM4 17.5A8.5 8.5 0 0 1 12.5 26L10 26A6 6 0 0 0 4 20zM4 12A14 14 0 0 1 18 26L15.5 26A11.5 11.5 0 0 0 4 14.5z',
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
