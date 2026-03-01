#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_FILES=()

for candidate in \
  "${ROOT_DIR}/frontend/src/components/app-header.tsx" \
  "${ROOT_DIR}/frontend/src/App.tsx" \
  "${ROOT_DIR}/frontend/src/app.tsx"
do
  if [[ -f "${candidate}" ]]; then
    APP_FILES+=("${candidate}")
  fi
done

if [[ ${#APP_FILES[@]} -eq 0 ]]; then
  echo "[nav-check] App entry/header file not found (expected app-header.tsx, App.tsx or app.tsx)" >&2
  exit 1
fi

contains_pattern() {
  local pattern="$1"
  local file
  for file in "${APP_FILES[@]}"; do
    if grep -Fq "$pattern" "$file"; then
      return 0
    fi
  done
  return 1
}

require_link() {
  local pattern="$1"
  local label="$2"

  if ! contains_pattern "$pattern"; then
    echo "[nav-check] Missing top menu link: ${label}" >&2
    exit 1
  fi
}

require_any_link() {
  local label="$1"
  shift
  local patterns=("$@")
  for pattern in "${patterns[@]}"; do
    if contains_pattern "$pattern"; then
      return 0
    fi
  done
  echo "[nav-check] Missing top menu link: ${label}" >&2
  exit 1
}

echo "[nav-check] Verifying top menu links in app header/entry files..."
require_link "href=\"/?status=DRAFT\"" "Drafts"
require_link "href=\"/?status=OPEN\"" "Open"
require_link "href=\"/?status=SIGNATURE\"" "Signature"
require_any_link "Live" "href=\"/?status=LIVE\"" "href=\"/?status=live\"" "href=\"https://darts.bzhtech.eu/?status=live\""
require_link "href=\"/?view=pool-stages\"" "Pool stages running"
require_link "href=\"/?view=brackets\"" "Brackets running"
require_link "href=\"/?status=FINISHED\"" "Finished"

echo "[nav-check] Top menu links verified."
