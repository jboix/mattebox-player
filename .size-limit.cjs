// One budget per package, min+brotli. kB is 1000 bytes. Needs `npm run build`.
// The core's budget is the number the design fixed. The element's was set
// at 30 kB for the bar, and v3 measured 23.9 kB with every control as an
// element, so it holds. The diagnostics element is a package of its own with
// its own budget. Raise any only with a reason in the commit body.
//
// A budget is a whole number of kB, a step above the measured size, not the
// measured size itself: the owner asked for round numbers on 2026-11-25.
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
    // 40 kB since a device can play in the video's place: `media`, the
    // hand-over of every load, the `casting` state and <mbx-casting> took
    // 1.87 kB, and the cast package gave its screen up. The owner set the
    // budget on 2026-11-14, with room for what casting still needs.
    limit: '40 kB',
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
    name: '@mattebox/player-spatial-nav/gamepad',
    path: 'packages/spatial-nav/dist/cdn/mattebox-player-spatial-nav-gamepad.min.js',
    disablePlugins: ['@size-limit/esbuild'],
    // The game controller and its help bubble, with the spatial navigation
    // they move focus with. A page with a remote alone loads the bundle above.
    // It measured 5.09 kB.
    ignore: ['mattebox', '@mattebox/player'],
    brotli: true,
    limit: '6 kB',
  },
  {
    name: '@mattebox/player-preferences',
    path: 'packages/preferences/dist/cdn/mattebox-player-preferences.min.js',
    disablePlugins: ['@size-limit/esbuild'],
    // The engine is a peer for its track helpers, and the player for its
    // types alone. The plan proposed 2 kB; the store, the element, and both
    // the engine's and Safari's tracks measured 2.93 kB, and 3.15 kB with
    // live captions as a subtitle choice.
    ignore: ['mattebox', '@mattebox/player'],
    brotli: true,
    limit: '4 kB',
  },
  {
    name: '@mattebox/player-ads',
    path: 'packages/ads/dist/cdn/mattebox-player-ads.min.js',
    disablePlugins: ['@size-limit/esbuild'],
    // The engine and the player are peers. The bundle carries the engine's
    // interstitials stage, about 6 kB with its emsg reader, because the
    // engine's CDN bundle leaves it out. The plan proposed 9 kB for the
    // package alone; with the stage it measured 17.32 kB, and 19.22 kB with
    // the promo, credits and chapter roles and the frosted elements.
    ignore: ['mattebox', '@mattebox/player'],
    brotli: true,
    limit: '20 kB',
  },
  {
    name: '@mattebox/player-live-captions',
    path: 'packages/live-captions/dist/cdn/mattebox-player-live-captions.min.js',
    disablePlugins: ['@size-limit/esbuild'],
    // The engine and the player are peers, read for their types alone. The
    // element, its language probe, the recognizer, the capture and the
    // transcript measured 4.01 kB, and 4.5 kB with the language the viewer
    // chose and the covered state.
    ignore: ['mattebox', '@mattebox/player'],
    brotli: true,
    limit: '5 kB',
  },
  {
    name: '@mattebox/player-360',
    path: 'packages/360/dist/cdn/mattebox-player-360.min.js',
    disablePlugins: ['@size-limit/esbuild'],
    // The engine and the player are peers, read for their types alone. The
    // element, the view's math, the WebGL renderer and its shaders, the
    // device's motion with its reduced-motion default, the WebXR headset
    // session, the split screen with its fullscreen, <mbx-vr-button> and
    // <mbx-motion-button> with their style measured 7.01 kB. The owner set
    // the budget at 10 kB on 2026-11-25.
    ignore: ['mattebox', '@mattebox/player'],
    brotli: true,
    limit: '10 kB',
  },
  {
    name: '@mattebox/player-playlist',
    path: 'packages/playlist/dist/cdn/mattebox-player-playlist.min.js',
    disablePlugins: ['@size-limit/esbuild'],
    // The player is a peer, read for its types alone. The controller, the
    // markup, the list panel and its buttons measured 6.45 kB; the up next
    // card and the preload come on top. With the list as a sheet over the
    // page it measured 8.11 kB. The owner set the budget at 10 kB on
    // 2026-11-23, with room for what the list still needs.
    brotli: true,
    limit: '10 kB',
  },
];
