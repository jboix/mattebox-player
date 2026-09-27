// A Rolldown plugin: `import STYLE from './seek-bar.css?inline';` becomes
// `const STYLE = "…";`, the file's CSS minified by Lightning CSS for the TV
// floor, inside the module that imports it. The controls put their CSS in a
// shadow root, so the CSS has to ship inside the JS: the page's bundler, if
// it has one, never sees a CSS import, and no CSS module becomes a file of
// its own beside the element. Vite reads `?inline` the same way for the
// demo and the tests.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { transform } from 'lightningcss';
import { RolldownMagicString } from 'rolldown';

const IMPORT = /^import (\w+) from '(\.{1,2}\/[^']+\.css)\?inline';$/gm;

/** Chromium 76, the floor in AGENTS.md rule 9, as Lightning CSS encodes a version. */
const TARGETS = { chrome: 76 << 16 };

/** The CSS of `filename`, minified for the floor. */
export function minifyCss(filename) {
  const { code } = transform({
    filename,
    code: readFileSync(filename),
    minify: true,
    targets: TARGETS,
  });
  return code.toString();
}

export function inlineCss() {
  return {
    name: 'mattebox-inline-css',
    transform(code, id) {
      if (!id.endsWith('.ts') || !code.includes('.css?inline')) return null;
      const out = new RolldownMagicString(code);
      for (const match of code.matchAll(IMPORT)) {
        const [line, name, path] = match;
        const filename = resolve(dirname(id), path);
        this.addWatchFile(filename);
        const start = match.index;
        out.overwrite(
          start,
          start + line.length,
          `const ${name} = ${JSON.stringify(minifyCss(filename))};`,
        );
      }
      return { code: out };
    },
  };
}
