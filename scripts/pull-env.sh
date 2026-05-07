#!/usr/bin/env bash
# Sync env vars from Vercel project → local .env.local.
#
# Use whenever:
#   - you join the project (first time setup)
#   - someone added/rotated an env var on Vercel
#   - your local .env.local is stale or missing
#
# Each dev MUST `vercel login` once and have access to the project.

set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v vercel >/dev/null 2>&1; then
  echo "ERR: Vercel CLI not installed. Run: pnpm add -g vercel" >&2
  exit 1
fi

if [[ ! -f .vercel/project.json ]]; then
  echo "==> No .vercel/project.json found. Linking…"
  vercel link --yes --project lungnote-webapp
fi

env_target="${1:-development}"
case "$env_target" in
  development|preview|production) ;;
  *) echo "ERR: env target must be development|preview|production"; exit 1 ;;
esac

echo "==> Pulling env from Vercel ($env_target) → .env.local"
vercel env pull .env.local --environment "$env_target" --yes

echo "==> Done. Vars in .env.local:"
grep -E '^[A-Z]' .env.local | cut -d= -f1 | sort
