// One budget per package, min+brotli. kB is 1000 bytes. Needs `npm run build`.
// The core's budget is the number the design fixed. The element's is a
// placeholder until the panels exist; deliverable 3 sets it at the first real
// measurement and holds it. Raise either only with a reason in the commit body.
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
    brotli: true,
    limit: '1.5 kB',
  },
];
