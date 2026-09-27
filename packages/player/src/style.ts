/**
 * The default styles of the element itself: the stage, fullscreen, and the
 * error surface under native controls. Every control carries its own sheet.
 * Two rules govern them.
 *
 * The box is black and the picture is centred in it, letterboxed or
 * pillarboxed by `object-fit: contain`, whatever height or ratio the page
 * gives the element: what fullscreen always did, now the default. With no
 * height from the page the stage is as tall as the picture and none of it
 * shows.
 *
 * Nothing carries `!important`. For normal declarations the outer tree wins
 * over the shadow tree, so any `::part()` rule the page writes beats these
 * whatever its specificity; an `!important` here would invert that and make
 * a part unstylable.
 *
 * Selectors stay at one attribute, and every element is reached through its
 * `part`, so the names in the stylesheet are the names the page uses.
 */
import STYLE_CSS from './player.css?inline';
export const STYLE = STYLE_CSS;
