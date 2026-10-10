/**
 * The playlist glyphs, copied from Vidstack's media-icons 0.10.0
 * (https://github.com/vidstack/media-icons): filled paths on a 32-unit
 * viewBox, drawn for a control bar, one visual weight across the set. The paths went
 * through svgo's path optimizer at 3 decimals, as the player's.
 * Copied, not depended on. The notice below is the license's one condition,
 * and packages/playlist/NOTICE repeats it for the published tarball.
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

export type IconName = 'playlist' | 'next' | 'previous' | 'shuffle' | 'repeat' | 'close';

const PATHS: Readonly<Record<IconName, string>> = {
  playlist:
    'M12 7.667c0-.369.299-.667.667-.667H26c.368 0 .667.298.667.667v2a.667.667 0 0 1-.667.666H12.667A.667.667 0 0 1 12 9.667zM12 15c0-.368.299-.667.667-.667H26c.368 0 .667.299.667.667v2a.667.667 0 0 1-.667.667H12.667A.667.667 0 0 1 12 17zm-6 6.667a.667.667 0 0 0-.667.666v2c0 .369.299.667.667.667h2a.667.667 0 0 0 .667-.667v-2A.667.667 0 0 0 8 21.667zm6.667 0a.667.667 0 0 0-.667.666v2c0 .369.299.667.667.667H26a.667.667 0 0 0 .667-.667v-2a.667.667 0 0 0-.667-.666zM6 14.333a.667.667 0 0 0-.667.667v2c0 .368.299.667.667.667h2A.667.667 0 0 0 8.667 17v-2A.667.667 0 0 0 8 14.333zM6 7a.667.667 0 0 0-.667.667v2c0 .368.299.666.667.666h2a.667.667 0 0 0 .667-.666v-2A.667.667 0 0 0 8 7z',
  next: 'M6.396 6.785a.667.667 0 0 0-1.063.537v17.357c0 .547.623.86 1.063.536l11.746-8.68a.667.667 0 0 0 0-1.072zm17.138-.118a.667.667 0 0 0-.667.666v17.334c0 .368.299.666.667.666h2a.667.667 0 0 0 .667-.666V7.333a.667.667 0 0 0-.667-.666z',
  previous:
    'M25.138 6.785a.667.667 0 0 1 1.063.537v17.357a.667.667 0 0 1-1.063.536l-11.746-8.68a.667.667 0 0 1 0-1.072zM8 6.667c.368 0 .667.298.667.666v17.334a.667.667 0 0 1-.667.666H6a.667.667 0 0 1-.667-.666V7.333c0-.368.299-.666.667-.666z',
  shuffle:
    'M23.73 5.653a.667.667 0 0 0-1.063.536v1.678c0 .073-.06.133-.134.133h-1.2a7.99 7.99 0 0 0-6.553 3.411.14.14 0 0 1-.226 0A7.99 7.99 0 0 0 8 8.001H6a.667.667 0 0 0-.667.666V10.4c0 .368.299.666.667.666h2a4.934 4.934 0 0 1 0 9.868H6a.667.667 0 0 0-.667.666v1.733c0 .369.299.667.667.667h2a7.99 7.99 0 0 0 6.554-3.41.14.14 0 0 1 .226 0A7.99 7.99 0 0 0 21.333 24h1.2c.074 0 .134.06.134.133v1.678c0 .547.622.862 1.063.537l4.527-3.346a.667.667 0 0 0 0-1.072l-4.527-3.345a.667.667 0 0 0-1.063.536v1.68c0 .073-.06.133-.134.133h-1.2a4.934 4.934 0 0 1 0-9.868h1.2c.074 0 .134.06.134.134v1.679c0 .547.622.861 1.063.536l4.527-3.345a.667.667 0 0 0 0-1.072z',
  repeat:
    'M22.197 4.988a.667.667 0 0 0-1.063.537v1.678c0 .073-.06.133-.133.133h-9.867a5.333 5.333 0 0 0-5.333 5.333v2c0 .368.298.667.666.667h1.734a.667.667 0 0 0 .666-.667v-1.6a2.667 2.667 0 0 1 2.667-2.667h9.467c.073 0 .133.06.133.134v1.679c0 .547.623.861 1.063.536l4.527-3.345a.667.667 0 0 0 0-1.073zm-11.332 19.81c0-.074.06-.134.134-.134h9.866a5.333 5.333 0 0 0 5.334-5.333v-2a.667.667 0 0 0-.667-.667h-1.733a.667.667 0 0 0-.667.667v1.6a2.667 2.667 0 0 1-2.667 2.667H11a.133.133 0 0 1-.134-.134v-1.679a.667.667 0 0 0-1.063-.536l-4.527 3.345a.667.667 0 0 0 0 1.073l4.527 3.345a.667.667 0 0 0 1.063-.537z',
  close:
    'M10.202 23.401c.26.26.682.26.943 0l4.76-4.761a.133.133 0 0 1 .19 0l4.76 4.761c.26.26.683.26.943 0l1.603-1.603a.667.667 0 0 0 0-.943l-4.761-4.76a.134.134 0 0 1 0-.19l4.761-4.76a.667.667 0 0 0 0-.943l-1.603-1.603a.667.667 0 0 0-.943 0l-4.76 4.761a.133.133 0 0 1-.19 0l-4.76-4.761a.667.667 0 0 0-.943 0l-1.603 1.603a.667.667 0 0 0 0 .943l4.761 4.76a.133.133 0 0 1 0 .19L8.6 20.854a.667.667 0 0 0 0 .943z',
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
