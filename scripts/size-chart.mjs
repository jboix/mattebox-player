#!/usr/bin/env node
// Renders docs/size-chart-{dark,light}.svg: the player over the engine's full
// preset against the other player stacks with the same reach (a UI, HLS and
// DASH). Every stack is bundled the same way, from its npm packages by
// rolldown, one entry per stack, then min+gzip. JavaScript only; a stack's
// stylesheet is not counted. The Mattebox row is the workspace build; the
// other stacks are pinned npm versions, installed at run time into
// scripts/size-chart/, whose lockfile pins their dependencies too. Bump a
// version here to move its bar; the lockfile follows on the next run.
//
//   npm run build && npm run size-chart
//   npm run size-chart -- --verbose   # lists the chunks each row counts
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { rolldown } from 'rolldown';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs');
/** Where the other stacks install: a manifest this script writes, and a committed lockfile. */
const STACKS_DIR = join(ROOT, 'scripts', 'size-chart');
const VERBOSE = process.argv.includes('--verbose');

/**
 * One row per stack. `entry` is what a page imports; `install` the pinned
 * packages it comes from (none for Mattebox: the workspace build). `skip`
 * names the dynamic chunks an HLS or DASH page never loads, matched against
 * the chunk's module ids, so a lazy import that is not on the page's path
 * does not count against the stack. `version` names the package whose
 * installed version the row shows; the Mattebox row is the working tree
 * and shows `main`. `detail` may be a function of a lookup of installed
 * versions.
 */
const STACKS = [
  {
    label: 'mattebox player',
    detail: (version) => `+ mattebox v${version('mattebox')}, full preset`,
    highlight: true,
    entry: "import '@mattebox/player';",
    // The element lazy-loads the preset the page names, one chunk each.
    // The `full` chunk is the one on the page's path.
    skip: /[\\/]mattebox[\\/].*[\\/]presets[\\/](?!full[\\/])/,
  },
  {
    // VHS is built into video.js 8 and covers both protocols.
    label: 'video.js 8 + vhs',
    detail: 'VHS built in',
    version: 'video.js',
    install: { 'video.js': '8.24.0' },
    entry: "import 'video.js';",
  },
  {
    // Video.js 10 is custom elements over hls.js and dash.js: the video
    // player, its skin and the two media elements, each from the `define`
    // entry that registers it (the preset root only exports the classes).
    // A release candidate until its GA.
    label: 'video.js 10 + hls.js + dash.js',
    detail: 'skin, hlsjs- and dash-video',
    version: '@videojs/html',
    install: {
      '@videojs/html': '10.0.0-rc.2',
      '@videojs/hlsjs-video': '10.0.0-rc.2',
      '@videojs/dash-video': '10.0.0-rc.2',
    },
    entry: [
      "import '@videojs/html/video/player';",
      "import '@videojs/html/video/skin';",
      "import '@videojs/html/media/hlsjs-video';",
      "import '@videojs/html/media/dash-video';",
    ].join('\n'),
    // One lazy chunk per locale; a page loads at most the browser's.
    skip: /[\\/]@videojs[\\/]core[\\/].*[\\/]i18n[\\/]locales[\\/]/,
  },
  {
    // The ui build carries the engine and the controls in one file. The
    // package has no export map, so the import names the file.
    label: 'shaka player + ui',
    detail: 'the ui build',
    version: 'shaka-player',
    install: { 'shaka-player': '5.2.10' },
    entry: "import 'shaka-player/dist/shaka-player.ui.js';",
  },
  {
    // Vidstack loads hls.js and dash.js from a CDN at run time; a bundled
    // page passes the imported libraries instead. Their bytes count either
    // way. Its captions renderer is a lazy chunk and counts.
    label: 'vidstack + hls.js + dash.js',
    detail: 'default layout',
    version: 'vidstack',
    install: { vidstack: '1.15.6', 'hls.js': '1.7.3', dashjs: '5.2.1' },
    entry: [
      "import 'vidstack/player';",
      "import 'vidstack/player/layouts/default';",
      "import 'vidstack/player/ui';",
      "import 'hls.js';",
      "import 'dashjs';",
    ].join('\n'),
    // The providers an HLS or DASH page never loads.
    skip: /[\\/]vidstack[\\/].*[\\/]providers[\\/]vidstack-(youtube|vimeo|google-cast|audio)\.js$/,
  },
  {
    // The controls, and the two elements that put hls.js and dash.js
    // behind a <video>.
    label: 'media chrome + hls.js + dash.js',
    detail: 'hls- and dash-video-element',
    version: 'media-chrome',
    install: {
      'media-chrome': '4.19.2',
      'hls-video-element': '1.5.11',
      'dash-video-element': '0.3.2',
    },
    entry: [
      "import 'media-chrome';",
      "import 'hls-video-element';",
      "import 'dash-video-element';",
    ].join('\n'),
  },
];

/**
 * Installs the pinned packages. The lockfile holds their dependencies still
 * between runs; npm rewrites it only when a version here moves.
 */
function installOthers() {
  const dependencies = {};
  for (const stack of STACKS) Object.assign(dependencies, stack.install);
  mkdirSync(STACKS_DIR, { recursive: true });
  writeFileSync(
    join(STACKS_DIR, 'package.json'),
    `${JSON.stringify({ name: 'size-chart', private: true, dependencies }, null, 2)}\n`,
  );
  execFileSync(
    'npm',
    ['install', '--no-audit', '--no-fund', '--ignore-scripts', '--loglevel=error'],
    {
      cwd: STACKS_DIR,
      stdio: 'inherit',
    },
  );
}

/** The version of a package installed under `dir`, read off its manifest. */
function installedVersion(dir, pkg) {
  return JSON.parse(readFileSync(join(dir, 'node_modules', pkg, 'package.json'), 'utf8')).version;
}

/**
 * Bundles one stack and sums min+gzip over the chunks the page loads: the
 * entry, everything it imports statically, and every dynamic chunk not
 * skipped, followed the same way. A skipped chunk's private modules stay
 * out; what it shares with a counted chunk is in a shared chunk and counts.
 */
async function stackBytes(stack) {
  // Under the node_modules the stack resolves from: the workspace's for
  // Mattebox, the pinned install for the others. Git ignores both.
  const dir = join(stack.install === undefined ? ROOT : STACKS_DIR, 'node_modules', '.size-chart');
  mkdirSync(dir, { recursive: true });
  const entry = join(dir, `${stack.label.replace(/[^a-z]+/g, '-')}.js`);
  writeFileSync(entry, `${stack.entry}\n`);
  const bundle = await rolldown({
    input: entry,
    platform: 'browser',
    logLevel: 'silent',
    // Vidstack imports its media libraries by URL at run time.
    external: (id) => /^https?:/.test(id),
  });
  const { output } = await bundle.generate({ format: 'es', minify: true });
  await bundle.close();

  const chunks = new Map(output.filter((o) => o.type === 'chunk').map((c) => [c.fileName, c]));
  const skipped = (chunk) =>
    stack.skip !== undefined && chunk.moduleIds.some((id) => stack.skip.test(id));
  const counted = new Set();
  const visit = (name) => {
    const chunk = chunks.get(name);
    if (chunk === undefined || counted.has(name)) return;
    counted.add(name);
    for (const dep of chunk.imports) visit(dep);
    for (const dep of chunk.dynamicImports) {
      const target = chunks.get(dep);
      if (target !== undefined && !skipped(target)) visit(dep);
    }
  };
  for (const chunk of chunks.values()) if (chunk.isEntry) visit(chunk.fileName);

  let bytes = 0;
  if (VERBOSE) console.log(`${stack.label}:`);
  for (const name of counted) {
    const chunk = chunks.get(name);
    const size = gzipSync(chunk.code, { level: 9 }).length;
    bytes += size;
    if (VERBOSE) {
      const from =
        chunk.facadeModuleId === null ? `${chunk.moduleIds.length} modules` : chunk.facadeModuleId;
      console.log(
        `  ${fmt(size).padStart(10)}  ${name}  (${from.replace(STACKS_DIR, '.').replace(ROOT, '.')})`,
      );
    }
  }
  return bytes;
}

async function rows() {
  const out = [];
  for (const stack of STACKS) {
    const version = (pkg) => installedVersion(stack.install === undefined ? ROOT : STACKS_DIR, pkg);
    out.push({
      label: stack.label,
      version: stack.install === undefined ? 'main' : `v${version(stack.version)}`,
      detail: typeof stack.detail === 'function' ? stack.detail(version) : stack.detail,
      bytes: await stackBytes(stack),
      highlight: stack.highlight === true,
    });
  }
  return out;
}

const THEMES = {
  dark: {
    bg: '#0b0b0d',
    text: '#f4f4f5',
    muted: '#8a8a93',
    track: '#18181c',
    bar: '#9a9aa2',
    accent: '#f5a524',
    axis: '#3a3a42',
  },
  light: {
    bg: '#ffffff',
    text: '#111114',
    muted: '#6b6b74',
    track: '#f0f0f3',
    bar: '#a1a1aa',
    accent: '#e8930c',
    axis: '#d4d4d9',
  },
};

const kb = (bytes) => bytes / 1024;
const fmt = (bytes) => `${kb(bytes).toFixed(1)} KB`;

function render(rows, theme, { title, subtitle, ariaLabel, tick }) {
  const t = THEMES[theme];
  const width = 1100;
  const left = 480;
  const right = 900;
  const rowH = 84;
  const barH = 54;
  const top = 150;
  const maxKb = Math.ceil(Math.max(...rows.map((r) => kb(r.bytes))) / tick) * tick;
  const scale = (right - left) / maxKb;
  const height = top + rows.length * rowH + 80;
  const font = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const mono = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

  const bars = rows
    .map((row, i) => {
      const y = top + i * rowH;
      const w = Math.max(3, kb(row.bytes) * scale);
      const fill = row.highlight ? t.accent : t.bar;
      const nameWeight = row.highlight ? 700 : 400;
      const valueWeight = row.highlight ? 700 : 400;
      const valueSize = row.highlight ? 30 : 26;
      return `
  <text x="44" y="${y + 26}" font-family="${font}" font-size="26" font-weight="${nameWeight}" fill="${t.text}">${row.label}</text>
  <text x="44" y="${y + 50}" font-family="${mono}" font-size="15" fill="${t.muted}">${row.version}${row.detail === '' ? '' : ` · ${row.detail}`}</text>
  <rect x="${left}" y="${y}" width="${right - left}" height="${barH}" fill="${t.track}"/>
  <rect x="${left}" y="${y}" width="${w.toFixed(1)}" height="${barH}" fill="${fill}"/>
  <text x="${width - 44}" y="${y + 36}" text-anchor="end" font-family="${mono}" font-size="${valueSize}" font-weight="${valueWeight}" fill="${row.highlight ? t.text : t.muted}">${fmt(row.bytes)}</text>`;
    })
    .join('');

  const ticks = [];
  for (let v = 0; v <= maxKb; v += tick) {
    const x = left + v * scale;
    ticks.push(
      `<line x1="${x.toFixed(1)}" y1="${height - 62}" x2="${x.toFixed(1)}" y2="${height - 54}" stroke="${t.axis}" stroke-width="2"/>`,
      `<text x="${x.toFixed(1)}" y="${height - 30}" text-anchor="middle" font-family="${mono}" font-size="15" fill="${t.muted}">${v}</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${ariaLabel}">
  <rect width="${width}" height="${height}" rx="18" fill="${t.bg}"/>
  <text x="44" y="60" font-family="${font}" font-size="34" font-weight="700" fill="${t.text}">${title}</text>
  <text x="44" y="98" font-family="${font}" font-size="22" fill="${t.muted}">${subtitle}</text>${bars}
  <line x1="${left}" y1="${height - 62}" x2="${right}" y2="${height - 62}" stroke="${t.axis}" stroke-width="2"/>
  ${ticks.join('\n  ')}
</svg>
`;
}

installOthers();
const all = await rows();
const chart = {
  file: 'size-chart',
  rows: [all[0], ...all.slice(1).sort((a, b) => a.bytes - b.bytes)],
  title: 'Video player size, HLS and DASH',
  subtitle:
    'min+gzip · KB · each stack bundled from npm the same way, JavaScript only (lower is better)',
  ariaLabel: 'Bundle size of video players with HLS and DASH playback, min+gzip, lower is better',
  tick: 100,
};
mkdirSync(OUT, { recursive: true });
for (const theme of Object.keys(THEMES)) {
  const path = join(OUT, `${chart.file}-${theme}.svg`);
  writeFileSync(path, render(chart.rows, theme, chart));
  console.log(`wrote ${path}`);
}
for (const row of chart.rows) {
  console.log(
    `${row.label.padEnd(32)} ${row.version.padEnd(9)} ${fmt(row.bytes).padStart(10)}  (${row.detail})`,
  );
}
