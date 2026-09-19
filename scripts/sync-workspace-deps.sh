#!/bin/sh
# Writes the releasing package's next version into its manifest, then points
# every cross-package range at the versions the workspace now ships. Runs from
# each package's semantic-release prepare step, before @semantic-release/npm,
# because `npm version` re-resolves the workspace tree: a range that no longer
# matches the bumped sibling sends npm to the registry and the install fails.
#
# Usage: sync-workspace-deps.sh <package-dir> <next-version>
set -eu

if [ "$#" -ne 2 ]; then
  echo "usage: $0 <package-dir> <next-version>" >&2
  exit 2
fi

package=$1
next=$2

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

npm pkg set "version=$next" -w "$package"

core=$(node -p "require('./packages/core/package.json').version")
npm pkg set "dependencies.@mattebox/player-core=^$core" -w packages/player
npm pkg set "devDependencies.@mattebox/player-core=^$core" -w packages/diagnostics

player=$(node -p "require('./packages/player/package.json').version")
npm pkg set "peerDependencies.@mattebox/player=>=$player" -w packages/diagnostics
