// One budget per package, min+brotli. kB is 1000 bytes. Needs `npm run build`.
// The core's budget is the number the design fixed. The element's was set at
// its first real measurement, 5.28 kB with the six panels, and moves only
// with the bar. While the bar is being built it sits at 30 kB and is set
// for real once the bar is complete. Raise either only with a reason in the
// commit body.
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
