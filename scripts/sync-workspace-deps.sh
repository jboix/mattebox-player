#!/bin/sh
# Points the element's dependency range at the core version the workspace
# ships, and the diagnostics element's peer range at the element's. Runs from
# each package's semantic-release prepare step, after what it depends on has
# released, so a published manifest never names a stale range.
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

version=$(node -p "require('./packages/core/package.json').version")
npm pkg set "dependencies.@mattebox/player-core=^$version" -w packages/player

player=$(node -p "require('./packages/player/package.json').version")
npm pkg set "peerDependencies.@mattebox/player=>=$player" -w packages/diagnostics
