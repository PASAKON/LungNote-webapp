#!/usr/bin/env bash
# Show git status across all 3 LungNote repos (webapp + wikis + design).
# Run from any of the 3 repos — auto-detects sibling layout.

set -euo pipefail

cd "$(dirname "$0")/.."
parent="$(cd .. && pwd)"

REPOS=(webapp wikis design)

for r in "${REPOS[@]}"; do
  dir="$parent/$r"
  echo "=== $r ==="
  if [[ ! -d "$dir/.git" ]]; then
    echo "  (not cloned at $dir)"
    continue
  fi
  branch=$(git -C "$dir" branch --show-current)
  ahead_behind=$(git -C "$dir" rev-list --left-right --count "@{u}...HEAD" 2>/dev/null || echo "0	0")
  behind=$(echo "$ahead_behind" | awk '{print $1}')
  ahead=$(echo "$ahead_behind" | awk '{print $2}')
  dirty=$(git -C "$dir" status --porcelain | wc -l | tr -d ' ')
  printf "  branch: %s | ahead: %s | behind: %s | uncommitted: %s\n" "$branch" "$ahead" "$behind" "$dirty"
  if [[ "$dirty" -gt 0 ]]; then
    git -C "$dir" status --short | sed 's/^/    /'
  fi
done
