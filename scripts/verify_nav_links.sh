#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_FILE="${ROOT_DIR}/frontend/src/App.tsx"

if [[ ! -f "${APP_FILE}" ]]; then
  echo "[nav-check] App.tsx not found at ${APP_FILE}" >&2
  exit 1
fi

require_link() {
  local pattern="$1"
  local label="$2"

  if ! grep -Fq "$pattern" "$APP_FILE"; then
    echo "[nav-check] Missing top menu link: ${label}" >&2
    exit 1
  fi
}

echo "[nav-check] Verifying top menu links in App.tsx..."
require_link "href=\"/?status=DRAFT\"" "Drafts"
require_link "href=\"/?status=OPEN\"" "Open"
require_link "href=\"/?status=SIGNATURE\"" "Signature"
require_link "href=\"/?status=LIVE\"" "Live"
require_link "href=\"/?view=pool-stages\"" "Pool stages running"
require_link "href=\"/?view=brackets\"" "Brackets running"
require_link "href=\"/?status=FINISHED\"" "Finished"

echo "[nav-check] Top menu links verified."
