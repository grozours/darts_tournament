#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "${ROOT_DIR}/scripts/check_docs_links.py" ]]; then
  echo "[docs-link-check] Missing script: scripts/check_docs_links.py" >&2
  exit 1
fi

echo "[docs-link-check] Verifying markdown links and anchors in docs/..."
python3 "${ROOT_DIR}/scripts/check_docs_links.py"
