# Contributing to the Mattebox player

Thanks for contributing. Agents working in this repository also follow
[AGENTS.md](../AGENTS.md). Participation is governed by the
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Setup

```sh
npm install
npx playwright install chromium firefox webkit   # browser and e2e tests
npm run verify    # everything CI checks
```

`verify` runs:

| Step                         | Tool                          | Checks                                                     |
| ---------------------------- | ----------------------------- | ---------------------------------------------------------- |
| `npm run lint`               | Biome                         | Formatting and lint rules                                  |
| `npm run docs:check`         | remark                        | Markdown formatting, broken links and anchors              |
| `npm run typecheck`          | tsc                           | Type errors, `strict` and `exactOptionalPropertyTypes`     |
| `npm run depcruise`          | dependency-cruiser            | The core never imports the UI, cycles, runtime deps        |
| `npm run knip`               | knip                          | Dead code, unused exports and dependencies                 |
| `npm run build`              | tsc + Rolldown, per package   | Modern ESM, types, ES2015 ESM, the element's CDN bundle    |
| `npm run check:emit`         | scripts/check-emit.mjs        | Banned TS constructs, stray bare import specifiers         |
| `npm run check:side-effects` | scripts/side-effect-audit.mjs | Importing the core in isolation creates no global          |
| `npx size-limit`             | size-limit                    | One budget per package, min+brotli                         |
| `npm run check:package`      | packages/\*/package.json      | publint and attw on each packed package                    |
| `npm run test`               | Vitest                        | Node tests, and browser tests in Chromium, Firefox, WebKit |

`npm run test:e2e` runs the Playwright tests against the built demo page. CI
runs them nightly and on labeled pull requests, `verify` does not.

Requirements: Node 24 or later (see `.nvmrc`) and npm. The workspace uses npm
workspaces; `package-lock.json` is the one lockfile.

## Layout

| Path              | Contents                                             |
| ----------------- | ---------------------------------------------------- |
| `packages/core`   | `@mattebox/player-core`                              |
| `packages/player` | `@mattebox/player`, with its CDN entry under `cdn/`  |
| `demo`            | The demo page, a Vite app over the packages' sources |
| `test/e2e`        | The Playwright tests over the demo page              |
| `docs/guide`      | The user guide, one chapter per topic                |
| `scripts`         | The check scripts `verify` runs                      |

Typecheck, tests, and the demo resolve the packages to their sources (the
`paths` in `tsconfig.json`, the aliases in the Vite and Vitest configs). The
package builds resolve through `node_modules` to built output, so the core
builds before the element.

## Rules

Each of these is checked automatically or in review:

1. **The boundary is strict.** The core never imports the UI. The UI never
   bypasses the core to talk to the engine about source selection.
2. **Runtime dependencies are the engine and the core.** The engine is a peer
   of both packages; the core is a dependency of the element. Nothing else.
3. **The element stays native.** Never forward or wrap an `HTMLMediaElement`
   member.
4. **No side effects in the core.** Importing it registers nothing. The
   element registers `<mattebox-player>` on import and nothing else.
5. **No normalization over native.** `session.engine` is null for native
   playback; the UI feature-tests.
6. **Every workaround of the engine is called out in a comment** where it
   happens: what was wanted, what had to be done instead, and which engine
   surface would have made it one call.
7. **Banned TypeScript:** non-const `enum`, `namespace`, parameter properties,
   decorators. The emit check catches violations.

## Commits

Conventional Commits. semantic-release reads the history when the Release
workflow is run, once per package, so the type is the version bump:

- `fix:` patch, `feat:` minor, `feat!:` or `BREAKING CHANGE:` major.
- `docs:`, `chore:`, `test:`, `refactor:` produce no release.

A package releases when a commit touched its directory. The subject is for
the changelog. A body is required.

`npm install` sets up the git hooks through husky. `commit-msg` runs
commitlint, `pre-commit` runs Biome on the staged files and the docs check,
and `pre-push` runs `npm run verify`.

## Style

If `npm run verify` passes, the style is right. If you disagree with a
check, open an issue rather than arguing in the pull request.
