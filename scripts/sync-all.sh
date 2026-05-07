#!/usr/bin/env bash
# Pull latest from origin/main on all 3 LungNote repos (webapp + wikis + design).
# Uses --rebase --autostash to avoid merge commits and keep dirty work intact.

set -euo pipefail

cd "$(dirname "$0")/.."
parent="$(cd .. && pwd)"

REPOS=(webapp wikis design)

for r in "${REPOS[@]}"; do
  dir="$parent/$r"
  echo "=== $r ==="
  if [[ ! -d "$dir/.git" ]]; then
    echo "  (not cloned at $dir — skipping)"
    continue
  fi
  git -C "$dir" fetch origin
  branch=$(git -C "$dir" branch --show-current)
  if [[ "$branch" != "main" ]]; then
    echo "  on branch '$branch' (not main) — skipping rebase, fetched only"
    continue
  fi
  git -C "$dir" pull --rebase --autostash
done
