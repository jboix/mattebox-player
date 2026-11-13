#!/usr/bin/env node
// Renders two charts, each in a dark and a light SVG, from the same method.
// Every stack is bundled from its npm packages by rolldown, one entry per
// stack, then min+gzip at level 9. A stack's stylesheets count too, as its
// package ships them: a page cannot show the player without them. Mattebox
// and video.js 10 keep their styles inside their JavaScript.
//
// - docs/size-chart-*.svg: a UI with HLS and DASH, MPEG-TS and DRM. The
//   player runs the engine's full preset.
// - docs/hls-chart-*.svg: a UI with HLS and fMP4 segments only, the reach of
//   SPF, video.js 10's own engine. The player runs the `hls` preset.
//
// The Mattebox rows are the workspace build. The other stacks are pinned npm
// versions, installed at run time into scripts/size-chart/, whose lockfile
// pins their dependencies too. Bump a version here to move its bar; the
// lockfile follows on the next run.
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
 * versions. `styles` names the stylesheets a page links for the stack,
 * as paths under its node_modules.
 */
/**
 * The video.js 10 packages every row of it installs. One version for all,
 * because the packages release together.
 */
const VIDEOJS = '10.4.0';

/** The video.js 10 player and its default skin. The skin carries its CSS inline. */
const VIDEOJS_PLAYER = [
  "import '@videojs/html/video/player';",
  "import '@videojs/html/video/skin';",
];

/** One lazy chunk per locale; a page loads at most the browser's. */
const VIDEOJS_LOCALES = /[\\/]@videojs[\\/](core|html)[\\/].*[\\/]i18n[\\/]locales[\\/]/;

/**
 * The full chart: one row per stack with a UI, HLS and DASH, MPEG-TS and
 * DRM. The Mattebox row is the full preset, the same reach.
 */
const FULL = [
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
    // Video.js 10 plays DASH, MPEG-TS and DRM through hls.js and dash.js,
    // each behind a media element of its own.
    label: 'video.js 10 + hls.js + dash.js',
    detail: 'skin, hlsjs- and dash-video',
    version: '@videojs/html',
    install: {
      '@videojs/html': VIDEOJS,
      '@videojs/hlsjs-video': VIDEOJS,
      '@videojs/dash-video': VIDEOJS,
    },
    entry: [
      ...VIDEOJS_PLAYER,
      "import '@videojs/html/media/hlsjs-video';",
      "import '@videojs/html/media/dash-video';",
    ].join('\n'),
    skip: VIDEOJS_LOCALES,
  },
  {
    // The ui build carries the engine and the controls in one file. The
    // package has no export map, so the import names the file.
    label: 'shaka player + ui',
    detail: 'the ui build',
    version: 'shaka-player',
    install: { 'shaka-player': '5.2.10' },
    entry: "import 'shaka-player/dist/shaka-player.ui.js';",
    styles: ['shaka-player/dist/controls.css'],
  },
  {
    // A commercial player. Its package is one prebuilt file with every
    // feature, and its interface is a second file and a stylesheet the
    // player loads beside it. The vendor also sells a modular build; this
    // row is the one a page gets from the package as published.
    label: 'bitmovin player',
    detail: 'the full bundle, with its ui',
    version: 'bitmovin-player',
    install: { 'bitmovin-player': '8.279.0' },
    entry: [
      "import 'bitmovin-player/bitmovinplayer.js';",
      "import 'bitmovin-player/bitmovinplayer-ui.js';",
    ].join('\n'),
    styles: ['bitmovin-player/bitmovinplayer-ui.css'],
  },
  {
    // A commercial player, now Dolby's. `THEOplayer.js` is the prebuilt
    // file with the interface inside. The transmuxer it fetches at run
    // time for MPEG-TS is not counted.
    label: 'theoplayer',
    detail: 'the full bundle, with its ui',
    version: 'theoplayer',
    install: { theoplayer: '11.13.0' },
    entry: "import 'theoplayer/THEOplayer.js';",
    styles: ['theoplayer/ui.css'],
  },
];

/**
 * The HLS chart: a UI and HLS with fMP4 segments, without MPEG-TS, DRM or
 * DASH. That is what SPF, video.js 10's own engine, plays. The Mattebox
 * row is the `hls` preset, the same reach.
 */
const HLS = [
  {
    label: 'mattebox player',
    detail: (version) => `+ mattebox v${version('mattebox')}, hls preset`,
    highlight: true,
    entry: "import '@mattebox/player';",
    skip: /[\\/]mattebox[\\/].*[\\/]presets[\\/](?!hls[\\/])/,
  },
  {
    // `hls-video` is the media element over SPF. It plays no MPEG-TS and
    // no DRM: video.js points those sources to `hlsjs-video`.
    label: 'video.js 10 + spf',
    detail: 'skin, hls-video',
    version: '@videojs/html',
    install: { '@videojs/html': VIDEOJS },
    entry: [...VIDEOJS_PLAYER, "import '@videojs/html/media/hls-video';"].join('\n'),
    skip: VIDEOJS_LOCALES,
  },
];

/**
 * Installs the pinned packages. The lockfile holds their dependencies still
 * between runs; npm rewrites it only when a version here moves.
 */
function installOthers() {
  const dependencies = {};
  for (const stack of [...FULL, ...HLS]) Object.assign(dependencies, stack.install);
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
  // The stylesheets, gzipped as the package ships them.
  for (const sheet of stack.styles ?? []) {
    const size = gzipSync(readFileSync(join(STACKS_DIR, 'node_modules', sheet)), {
      level: 9,
    }).length;
    bytes += size;
    if (VERBOSE) console.log(`  ${fmt(size).padStart(10)}  ${sheet}`);
  }
  return bytes;
}

/** Measures each stack of a chart, in the order given. */
async function rows(stacks) {
  const out = [];
  for (const stack of stacks) {
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
const SUBTITLE =
  'min+gzip · KB · each stack bundled from npm the same way, with its styles (lower is better)';
const CHARTS = [
  {
    file: 'size-chart',
    stacks: FULL,
    title: 'Video player size, HLS and DASH',
    subtitle: SUBTITLE,
    ariaLabel: 'Bundle size of video players with HLS and DASH playback, min+gzip, lower is better',
    tick: 100,
  },
  {
    file: 'hls-chart',
    stacks: HLS,
    title: 'Video player size, HLS with fMP4 segments',
    subtitle: SUBTITLE,
    ariaLabel:
      'Bundle size of video players with HLS playback of fMP4 segments, min+gzip, lower is better',
    tick: 25,
  },
];
mkdirSync(OUT, { recursive: true });
for (const chart of CHARTS) {
  const all = await rows(chart.stacks);
  // Mattebox first, the others from the smallest up.
  const sorted = [all[0], ...all.slice(1).sort((a, b) => a.bytes - b.bytes)];
  for (const theme of Object.keys(THEMES)) {
    const path = join(OUT, `${chart.file}-${theme}.svg`);
    writeFileSync(path, render(sorted, theme, chart));
    console.log(`wrote ${path}`);
  }
  for (const row of sorted) {
    console.log(
      `${row.label.padEnd(32)} ${row.version.padEnd(9)} ${fmt(row.bytes).padStart(10)}  (${row.detail})`,
    );
  }
}
