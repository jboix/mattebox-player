#!/bin/sh
# Points the element's dependency range at the core version the workspace
# ships. Runs from the element's semantic-release prepare step, after the
# core has released, so the published manifest never names a stale range.
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

version=$(node -p "require('./packages/core/package.json').version")
npm pkg set "dependencies.@mattebox/player-core=^$version" -w packages/player
