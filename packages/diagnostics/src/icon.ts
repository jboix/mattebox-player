/**
 * The glyph, Mattebox's own drawing in the player's style: a filled path
 * on a 32-unit viewBox.
 */

/** The "info" glyph: a ring with a dot and a bar, drawn even-odd so the ring is hollow. */
const INFO =
  'M16 4.5A11.5 11.5 0 1 0 16 27.5A11.5 11.5 0 1 0 16 4.5zM16 7A9 9 0 1 1 16 25A9 9 0 1 1 16 7zM14.75 14h2.5v8.5h-2.5zM14.75 9.5h2.5v2.5h-2.5z';

const SVG = 'http://www.w3.org/2000/svg';

/** The glyph, hidden from the accessibility tree: the button carries the name. */
export function icon(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('part', 'icon');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('fill-rule', 'evenodd');
  path.setAttribute('d', INFO);
  svg.append(path);
  return svg;
}
