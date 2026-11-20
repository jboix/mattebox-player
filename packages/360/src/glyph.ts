/**
 * The buttons' glyphs: a slot a page drops its own SVG into, with the
 * package's drawing as the fallback.
 */
const SVG = 'http://www.w3.org/2000/svg';

/** One shape of a glyph on a 32-unit viewBox: filled, or drawn as a 2-unit line when `line`. */
export interface Shape {
  readonly d: string;
  readonly line?: boolean;
}

/** A slot named `name` whose fallback is `shapes`, in the text's colour. */
export function glyph(name: string, shapes: readonly Shape[]): HTMLSlotElement {
  const node = document.createElement('slot');
  node.name = name;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('part', 'icon');
  for (const shape of shapes) {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', shape.d);
    if (shape.line === true) {
      // An attribute on the path wins over the fill the icon inherits.
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-linecap', 'round');
    } else {
      path.setAttribute('fill-rule', 'evenodd');
    }
    svg.append(path);
  }
  node.append(svg);
  return node;
}
