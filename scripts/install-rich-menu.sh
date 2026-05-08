#!/usr/bin/env bash
# Install LungNote default Rich Menu on the LINE OA channel.
#
# Idempotent: if a previous "LungNote Default Rich Menu" exists, deletes it
# first, then creates fresh, uploads the PNG, and sets as default for all
# users.
#
# Required env:
#   LINE_CHANNEL_ACCESS_TOKEN   — Messaging API channel token
#   NEXT_PUBLIC_LINE_LIFF_ID    — substituted into rich-menu URIs
#
# Required args (positional):
#   $1 = path to rich-menu JSON template (with YOUR_LIFF_ID placeholders)
#   $2 = path to rich-menu PNG (2500x1686, RGB, < 1MB)
#
# Examples:
#   ./scripts/install-rich-menu.sh \
#     ../design/line-rich-menu/lungnote-rich-menu-default.json \
#     ../design/line-rich-menu/lungnote-rich-menu-default-2500x1686.png
#
#   # or with light theme PNG
#   ./scripts/install-rich-menu.sh \
#     ../design/line-rich-menu/lungnote-rich-menu-default.json \
#     ../design/line-rich-menu/lungnote-rich-menu-light-2500x1686.png

set -euo pipefail

JSON_TEMPLATE="${1:?usage: install-rich-menu.sh <json-template> <png-file>}"
PNG_FILE="${2:?usage: install-rich-menu.sh <json-template> <png-file>}"

: "${LINE_CHANNEL_ACCESS_TOKEN:?LINE_CHANNEL_ACCESS_TOKEN env var required}"
: "${NEXT_PUBLIC_LINE_LIFF_ID:?NEXT_PUBLIC_LINE_LIFF_ID env var required}"

if [[ ! -f "$JSON_TEMPLATE" ]]; then
  echo "ERR: JSON template not found: $JSON_TEMPLATE" >&2; exit 1
fi
if [[ ! -f "$PNG_FILE" ]]; then
  echo "ERR: PNG not found: $PNG_FILE" >&2; exit 1
fi

API="https://api.line.me/v2/bot"
DATA_API="https://api-data.line.me/v2/bot"

echo "==> Substituting placeholders"
JSON_PROCESSED=$(mktemp)
sed \
  -e "s|YOUR_LIFF_ID|${NEXT_PUBLIC_LINE_LIFF_ID}|g" \
  -e "s|lungnote\.app|lungnote.com|g" \
  "$JSON_TEMPLATE" >"$JSON_PROCESSED"

NAME=$(jq -r '.name' "$JSON_PROCESSED")
echo "    name = $NAME"

echo "==> Listing existing rich menus"
EXISTING=$(curl -fsSL -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" \
  "$API/richmenu/list")

OLD_IDS=$(echo "$EXISTING" | jq -r --arg N "$NAME" '.richmenus[] | select(.name==$N) | .richMenuId')
for OLD in $OLD_IDS; do
  echo "    deleting old rich menu $OLD"
  curl -fsS -X DELETE -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" \
    "$API/richmenu/$OLD" >/dev/null
done

echo "==> Creating rich menu"
CREATE_RES=$(curl -fsSL -X POST \
  -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @"$JSON_PROCESSED" \
  "$API/richmenu")
RICH_MENU_ID=$(echo "$CREATE_RES" | jq -r '.richMenuId')
echo "    richMenuId = $RICH_MENU_ID"

if [[ -z "$RICH_MENU_ID" || "$RICH_MENU_ID" == "null" ]]; then
  echo "ERR: failed to create rich menu" >&2
  echo "$CREATE_RES" >&2
  exit 1
fi

echo "==> Uploading PNG"
curl -fsS -X POST \
  -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" \
  -H "Content-Type: image/png" \
  --data-binary "@$PNG_FILE" \
  "$DATA_API/richmenu/$RICH_MENU_ID/content" >/dev/null

echo "==> Setting as default for all users"
curl -fsS -X POST \
  -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" \
  -H "Content-Length: 0" \
  "$API/user/all/richmenu/$RICH_MENU_ID" >/dev/null

echo
echo "✅ Rich menu installed. richMenuId = $RICH_MENU_ID"
echo "   Open LINE app → chat OA → menu should appear."

rm -f "$JSON_PROCESSED"
