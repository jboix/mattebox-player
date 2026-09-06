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
      name: 'ui-reaches-the-core-through-its-package',
      comment: 'The element imports @mattebox/player-core, never packages/core/src by path.',
      severity: 'error',
      from: { path: '^packages/player/' },
      to: { path: '^packages/core/' },
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
        'Only the engine (a peer) and the core (a workspace package) may be imported at runtime.',
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
