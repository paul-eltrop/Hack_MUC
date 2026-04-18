#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/.env"

echo "Verbindung zu Manex API prüfen..."
if curl -sf -o /dev/null -H "Authorization: Bearer $MANEX_API_KEY" "$MANEX_API_URL/defect?limit=1"; then
  echo "  API erreichbar: $MANEX_API_URL"
else
  echo "  FEHLER: API nicht erreichbar unter $MANEX_API_URL" >&2
  exit 1
fi

echo "Studio UI öffnen: $MANEX_STUDIO_URL"
open "$MANEX_STUDIO_URL" 2>/dev/null || xdg-open "$MANEX_STUDIO_URL" 2>/dev/null || true

echo ""
echo "Umgebungsvariablen gesetzt:"
echo "  MANEX_API_URL=$MANEX_API_URL"
echo "  MANEX_DB_URL=$MANEX_DB_URL"
echo "  MANEX_IMAGE_URL=$MANEX_IMAGE_URL"
echo ""
echo "Quick-Test:"
echo "  curl -H \"Authorization: Bearer \$MANEX_API_KEY\" \"\$MANEX_API_URL/defect?limit=5\""
echo ""
echo "Bereit."
