#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

cd "$BACKEND_DIR"

npm install

npm run typecheck

lint_status=0
if [[ "${1:-}" == "--fix" ]]; then
  npm run lint:fix || lint_status=$?
else
  npm run lint || lint_status=$?
fi

"$ROOT_DIR/scripts/sonar_scan.sh"

exit "$lint_status"
