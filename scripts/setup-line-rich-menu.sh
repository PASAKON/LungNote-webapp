#!/usr/bin/env bash
# Install LINE Rich Menu for the LungNote OA.
#
# What this does (1-time setup, idempotent on re-run):
#   1. POST rich menu config (areas + actions) to LINE → get rich menu ID
#   2. PUT the PNG image (2500×1686) to that rich menu
#   3. POST default rich menu so every user sees it
#
# Inputs (relative to the webapp/ dir, but image lives in the design repo):
#   - rich menu config:  ../design/line-rich-menu/lungnote-rich-menu-default.json
#                        (or pass first arg: ./scripts/setup-line-rich-menu.sh /path/to/config.json /path/to/image.png)
#   - rich menu image:   ../design/line-rich-menu/lungnote-rich-menu-default-2500x1686.png
#
# Required env (read from .env.local):
#   - LINE_CHANNEL_ACCESS_TOKEN
#
# Re-running deletes existing rich menus tied to the same name first
# (LINE keeps stale ones if you don't clean up, and the default-rich-menu
# pointer breaks silently when the underlying menu is gone).

set -euo pipefail

cd "$(dirname "$0")/.."

CONFIG="${1:-../design/line-rich-menu/lungnote-rich-menu-default.json}"
IMAGE="${2:-../design/line-rich-menu/lungnote-rich-menu-default-2500x1686.png}"

if [[ ! -f "$CONFIG" ]]; then
  echo "ERR: config not found: $CONFIG" >&2
  exit 1
fi
if [[ ! -f "$IMAGE" ]]; then
  echo "ERR: image not found: $IMAGE" >&2
  exit 1
fi

if [[ -z "${LINE_CHANNEL_ACCESS_TOKEN:-}" ]]; then
  if [[ -f .env.local ]]; then
    LINE_CHANNEL_ACCESS_TOKEN=$(grep '^LINE_CHANNEL_ACCESS_TOKEN' .env.local | cut -d= -f2- | tr -d '"' | tr -d "'")
  fi
fi
if [[ -z "${LINE_CHANNEL_ACCESS_TOKEN:-}" ]]; then
  echo "ERR: LINE_CHANNEL_ACCESS_TOKEN not set (env or .env.local)" >&2
  exit 1
fi

NAME=$(jq -r '.name' "$CONFIG")
echo "==> Rich menu name: $NAME"

# 1. Clean stale rich menus with the same name (and unset default if it points at one)
echo "==> Listing existing rich menus..."
DEFAULT_OLD=$(curl -sf -X GET "https://api.line.me/v2/bot/user/all/richmenu" \
  -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" 2>/dev/null \
  | jq -r '.richMenuId // empty' || echo "")

EXISTING_IDS=$(curl -sf -X GET "https://api.line.me/v2/bot/richmenu/list" \
  -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" \
  | jq -r --arg n "$NAME" '.richmenus[] | select(.name == $n) | .richMenuId')

if [[ -n "$EXISTING_IDS" ]]; then
  if [[ -n "$DEFAULT_OLD" ]] && echo "$EXISTING_IDS" | grep -qx "$DEFAULT_OLD"; then
    echo "==> Unsetting default rich menu (stale)..."
    curl -sf -X DELETE "https://api.line.me/v2/bot/user/all/richmenu" \
      -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" >/dev/null
  fi
  echo "==> Deleting stale rich menus with name '$NAME':"
  while IFS= read -r id; do
    [[ -z "$id" ]] && continue
    echo "    - $id"
    curl -sf -X DELETE "https://api.line.me/v2/bot/richmenu/$id" \
      -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" >/dev/null
  done <<< "$EXISTING_IDS"
fi

# 2. Create rich menu (returns id)
echo "==> Creating rich menu..."
NEW_ID=$(curl -sf -X POST "https://api.line.me/v2/bot/richmenu" \
  -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data @"$CONFIG" \
  | jq -r '.richMenuId')

if [[ -z "$NEW_ID" || "$NEW_ID" == "null" ]]; then
  echo "ERR: rich menu create failed" >&2
  exit 1
fi
echo "    id: $NEW_ID"

# 3. Upload PNG (use api-data subdomain per LINE spec)
echo "==> Uploading PNG ($IMAGE)..."
curl -sf -X POST "https://api-data.line.me/v2/bot/richmenu/$NEW_ID/content" \
  -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" \
  -H "Content-Type: image/png" \
  --data-binary @"$IMAGE" >/dev/null

# 4. Set as default for every user
echo "==> Setting as default rich menu..."
curl -sf -X POST "https://api.line.me/v2/bot/user/all/richmenu/$NEW_ID" \
  -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" >/dev/null

echo
echo "✅ Rich menu installed. ID = $NEW_ID"
echo "   To verify: open LINE chat with the OA — menu should appear at the bottom."
