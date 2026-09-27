/**
 * The element's stylesheet. The button is drawn the way the player's own
 * buttons are, in a copy: the player's styles are internal, and a control
 * of the page's own carries its own sheet. Tokens come through the
 * `--mbx-*` custom properties the player sets, which inherit through light
 * DOM; the chart colours have defaults here and a page overrides them the
 * same way. Nothing carries `!important`, so a page's `::part()` rule wins.
 */
import STYLE_CSS from './style.css?inline';

export const STYLE = STYLE_CSS;
