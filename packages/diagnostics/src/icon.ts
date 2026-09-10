/**
 * The glyph, copied from Vidstack's media-icons 0.10.0
 * (https://github.com/vidstack/media-icons), the same set the player draws
 * its own from: filled paths on a 32-unit viewBox. Copied, not depended
 * on; the notice ships as NOTICE in the package.
 *
 * MIT License
 *
 * Copyright (c) 2023 Rahim Alwer
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/** The "info" glyph: a ring with a dot and a bar, drawn even-odd so the ring is hollow. */
const INFO =
  'M17.534 10.6674C17.534 11.5143 16.8475 12.2008 16.0006 12.2008C15.1538 12.2008 14.4673 11.5143 14.4673 10.6674C14.4673 9.82061 15.1538 9.13411 16.0006 9.13411C16.8475 9.13411 17.534 9.82061 17.534 10.6674Z M14.6678 14.2005C14.6678 13.8323 14.9663 13.5339 15.3345 13.5339H16.6678C17.036 13.5339 17.3345 13.8323 17.3345 14.2005V22.2005C17.3345 22.5687 17.036 22.8672 16.6678 22.8672H15.3345C14.9663 22.8672 14.6678 22.5687 14.6678 22.2005V14.2005Z M28 16C28 22.6274 22.6274 28 16 28C9.37258 28 4 22.6274 4 16C4 9.37258 9.37258 4 16 4C22.6274 4 28 9.37258 28 16ZM24.9333 16C24.9333 20.9337 20.9337 24.9333 16 24.9333C11.0663 24.9333 7.06667 20.9337 7.06667 16C7.06667 11.0663 11.0663 7.06667 16 7.06667C20.9337 7.06667 24.9333 11.0663 24.9333 16Z';

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
