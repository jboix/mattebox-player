/**
 * A control's CSS, imported as text for its shadow root. The builds inline
 * each file, minified, through `scripts/lib/inline-css.mjs`; Vite does the
 * same for the demo and the tests.
 */
declare module '*.css?inline' {
  const css: string;
  export default css;
}
