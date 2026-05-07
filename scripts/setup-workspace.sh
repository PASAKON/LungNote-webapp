#!/usr/bin/env bash
# Bootstrap a fresh LungNote dev workspace.
#
# Layout:
#   <chosen parent dir>/
#   ├── webapp/   ← PASAKON/LungNote-webapp
#   ├── wikis/    ← PASAKON/LungNote-wikis
#   └── design/   ← PASAKON/LungNote-design
#
# Usage:
#   curl -sL <raw-url-of-this-script> | bash -s -- ~/code/lungnote
#   # or, after cloning webapp first:
#   ./scripts/setup-workspace.sh

set -euo pipefail

GH_OWNER="PASAKON"
REPOS=("LungNote-webapp:webapp" "LungNote-wikis:wikis" "LungNote-design:design")

target="${1:-$(pwd)}"
if [[ "$(basename "$target")" == "webapp" && -f "$target/package.json" ]]; then
  target="$(cd "$target/.." && pwd)"
fi
mkdir -p "$target"
cd "$target"

echo "==> Workspace root: $target"
echo

for entry in "${REPOS[@]}"; do
  repo="${entry%%:*}"
  dir="${entry##*:}"
  if [[ -d "$dir/.git" ]]; then
    echo "==> $dir already cloned — pulling latest"
    git -C "$dir" pull --rebase --autostash
  else
    echo "==> Cloning $GH_OWNER/$repo → $dir"
    git clone "https://github.com/$GH_OWNER/$repo.git" "$dir"
  fi
done

echo
echo "==> Installing webapp deps"
cd webapp
if command -v pnpm >/dev/null 2>&1; then
  pnpm install
else
  echo "WARN: pnpm not found. Install with: npm i -g pnpm"
fi

echo
echo "==> Pulling shared env vars from Vercel"
if command -v vercel >/dev/null 2>&1; then
  if [[ ! -f .vercel/project.json ]]; then
    echo "Linking to Vercel project (may prompt for login)…"
    vercel link --yes --project lungnote-webapp
  fi
  vercel env pull .env.local --yes || echo "WARN: vercel env pull failed — make sure you have access to passgob1-8454s-projects/lungnote-webapp"
else
  echo "WARN: Vercel CLI not found. Install with: pnpm add -g vercel"
fi

echo
echo "==> Done."
echo "Open in editor:  cd $target/webapp && code ."
echo "Open vault:      cd $target/wikis && obsidian ."
echo "Run dev:         cd $target/webapp && pnpm dev"
