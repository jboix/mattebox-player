// One budget per package, min+brotli. kB is 1000 bytes. Needs `npm run build`.
// The core's budget is the number the design fixed. The element's was set
// at 30 kB for the bar, and v3 measured 23.9 kB with every control as an
// element, so it holds. The diagnostics element is a package of its own with
// its own budget. Raise any only with a reason in the commit body.
//
// The CDN bundles are measured as served: size-limit would otherwise bundle
// each file again with esbuild, which adds about 0.7 kB of wrapper nobody
// downloads. The core is a set of modules, so it still needs the bundling.
module.exports = [
  {
    name: '@mattebox/player-core',
    path: 'packages/core/dist/index.js',
    // The engine is a peer: never part of the core's download.
    ignore: ['mattebox'],
    brotli: true,
    // Room for the core to grow: the list of sources and the preload
    // took it past 2 kB.
    limit: '5 kB',
  },
  {
    name: '@mattebox/player',
    path: 'packages/player/dist/cdn/mattebox-player.min.js',
    disablePlugins: ['@size-limit/esbuild'],
    // The engine is a peer here too: the CDN bundle reads it from the
    // `mattebox` global, and its dynamic preset imports resolve against the
    // page's engine, never into this download.
    ignore: ['mattebox'],
    brotli: true,
    // 31 kB since the languages: the registry, the language the player
    // resolves and watches, and an id at every word took 0.68 kB.
    limit: '31 kB',
  },
  {
    name: '@mattebox/player-diagnostics',
    path: 'packages/diagnostics/dist/cdn/mattebox-player-diagnostics.min.js',
    disablePlugins: ['@size-limit/esbuild'],
    // The engine and the player are peers: the bundle reads the engine from
    // the `mattebox` global and takes nothing from the player at runtime.
    ignore: ['mattebox', '@mattebox/player'],
    brotli: true,
    limit: '20 kB',
  },
  {
    name: '@mattebox/player-cast',
    path: 'packages/cast/dist/cdn/mattebox-player-cast.min.js',
    disablePlugins: ['@size-limit/esbuild'],
    // The engine and the player are peers; the Cast sender SDK is a script
    // the page loads at runtime and is never part of the download.
    ignore: ['mattebox', '@mattebox/player'],
    brotli: true,
    limit: '8 kB',
  },
  {
    name: '@mattebox/player-spatial-nav',
    path: 'packages/spatial-nav/dist/cdn/mattebox-player-spatial-nav.min.js',
    disablePlugins: ['@size-limit/esbuild'],
    // The player is a peer, read for its types alone. The TV plan fixed the
    // spatial navigation at 1.5 kB; the key codes and Back ride with it.
    ignore: ['mattebox', '@mattebox/player'],
    brotli: true,
    limit: '2 kB',
  },
  {
    name: '@mattebox/player-playlist',
    path: 'packages/playlist/dist/cdn/mattebox-player-playlist.min.js',
    disablePlugins: ['@size-limit/esbuild'],
    // The player is a peer, read for its types alone. The controller, the
    // markup, the list panel and its buttons measured 6.45 kB; the up next
    // card and the preload come on top. 8 kB holds them.
    brotli: true,
    limit: '8 kB',
  },
];
