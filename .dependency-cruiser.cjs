// The boundary rules. See docs/architecture.md.
module.exports = {
  forbidden: [
    {
      name: 'core-never-imports-the-ui',
      comment: 'The core is the headless layer; an integrator with their own UI takes it alone.',
      severity: 'error',
      from: { path: '^packages/core/' },
      to: { path: '^packages/player/|node_modules/@mattebox/player/' },
    },
    {
      name: 'ui-reaches-the-core-through-its-entry',
      comment:
        'The element imports @mattebox/player-core and gets its entry. Both the workspace ' +
        'symlink and the tsconfig paths resolve that specifier to packages/core/src/index.ts, ' +
        'so the checkable invariant is the one that matters: anything else under the core is a ' +
        'reach into its internals.',
      severity: 'error',
      from: { path: '^packages/(player|diagnostics)/' },
      to: { path: '^packages/core/src/', pathNot: '^packages/core/src/index\\.ts$' },
    },
    {
      name: 'diagnostics-reaches-the-player-through-its-entry',
      comment:
        "The diagnostics element is a control of the page's own kind: it takes the player's " +
        'public types from its entry and nothing from its internals.',
      severity: 'error',
      from: { path: '^packages/diagnostics/' },
      to: { path: '^packages/player/src/', pathNot: '^packages/player/src/index\\.ts$' },
    },
    {
      name: 'the-player-never-imports-the-diagnostics',
      comment: 'The diagnostics package is optional; the player must not know it.',
      severity: 'error',
      from: { path: '^packages/(core|player)/' },
      to: { path: '^packages/diagnostics/|node_modules/@mattebox/player-diagnostics/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'runtime-deps-are-the-engine-and-the-core',
      comment:
        'Only the engine (a peer) and the core (a workspace package) may be imported at runtime. ' +
        'The diagnostics package reads the player for its types alone, which the emit check proves.',
      severity: 'error',
      from: { path: '^packages/[^/]+/(src|cdn)/' },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-no-pkg', 'npm-unknown'],
        dependencyTypesNot: ['npm-peer'],
        pathNot: 'node_modules/(mattebox|@mattebox/player-core)/',
      },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      from: { orphan: true, pathNot: '\\.d\\.ts$' },
      to: {},
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    doNotFollow: { path: 'node_modules' },
    // Type-only imports count.
    tsPreCompilationDeps: true,
  },
};
