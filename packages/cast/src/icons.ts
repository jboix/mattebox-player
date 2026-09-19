/**
 * The play and pause glyphs, copied from Vidstack's media-icons 0.10.0
 * (https://github.com/vidstack/media-icons): filled paths on a 32-unit
 * viewBox, drawn for a control bar, one visual weight across the set.
 * Copied, not depended on. The notice below is the license's one condition,
 * and packages/player/NOTICE repeats it for the published tarball.
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

export type IconName = 'play' | 'pause' | 'cast' | 'cast-active';

/** Each glyph's subpaths joined into one `d`, drawn even-odd like the player's. */
const PATHS: Readonly<Record<IconName, string>> = {
  play: 'M10.6667 6.6548C10.6667 6.10764 11.2894 5.79346 11.7295 6.11862L24.377 15.4634C24.7377 15.7298 24.7377 16.2692 24.3771 16.5357L11.7295 25.8813C11.2895 26.2065 10.6667 25.8923 10.6667 25.3451L10.6667 6.6548Z',
  pause:
    'M8.66667 6.66667C8.29848 6.66667 8 6.96514 8 7.33333V24.6667C8 25.0349 8.29848 25.3333 8.66667 25.3333H12.6667C13.0349 25.3333 13.3333 25.0349 13.3333 24.6667V7.33333C13.3333 6.96514 13.0349 6.66667 12.6667 6.66667H8.66667Z M19.3333 6.66667C18.9651 6.66667 18.6667 6.96514 18.6667 7.33333V24.6667C18.6667 25.0349 18.9651 25.3333 19.3333 25.3333H23.3333C23.7015 25.3333 24 25.0349 24 24.6667V7.33333C24 6.96514 23.7015 6.66667 23.3333 6.66667H19.3333Z',
  // The cast glyphs are this package's own drawing, not media-icons: a
  // screen with the corner open for three arcs, filled while casting.
  cast: 'M4 6h24v18H20v-2h6V8H6v1H4V6zM4 21a3 3 0 0 1 3 3H4zM4 15a9 9 0 0 1 9 9h-2a7 7 0 0 0-7-7zM4 10a14 14 0 0 1 14 14h-2A12 12 0 0 0 4 12z',
  'cast-active':
    'M4 6h24v18H20A16 16 0 0 0 4 8zM4 21a3 3 0 0 1 3 3H4zM4 15a9 9 0 0 1 9 9h-2a7 7 0 0 0-7-7zM4 10a14 14 0 0 1 14 14h-2A12 12 0 0 0 4 12z',
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
