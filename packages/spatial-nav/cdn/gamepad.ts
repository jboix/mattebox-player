/**
 * The CDN entry of the game controller: the `./gamepad` entry behind the
 * `matteboxPlayerSpatialNav` global, the spatial navigation included.
 * Importing registers <mbx-spatial-nav>, <mbx-gamepad> and
 * <mbx-gamepad-help>. A page loads this bundle or the spatial navigation's,
 * not both.
 */
export * from '../src/gamepad-index.js';
