// One budget per package, min+brotli. kB is 1000 bytes. Needs `npm run build`.
// The core's budget is the number the design fixed. The element's was set
// at 30 kB for the bar, and v3 measured 23.9 kB with every control as an
// element, so it holds. Raise either only with a reason in the commit body.
module.exports = [
  {
    name: '@mattebox/player-core',
    path: 'packages/core/dist/index.js',
    // The engine is a peer: never part of the core's download.
    ignore: ['mattebox'],
    brotli: true,
    limit: '2 kB',
  },
  {
    name: '@mattebox/player',
    path: 'packages/player/dist/cdn/mattebox-player.min.js',
    // The engine is a peer here too: the CDN bundle reads it from the
    // `mattebox` global, and its dynamic preset imports resolve against the
    // page's engine, never into this download.
    ignore: ['mattebox'],
    brotli: true,
    limit: '30 kB',
  },
];
