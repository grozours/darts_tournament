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

if [[ "${LINT_RUN_SONAR:-false}" == "true" ]]; then
  sonar_status=0
  "$ROOT_DIR/scripts/sonar_scan.sh" || sonar_status=$?

  if [[ ${sonar_status} -ne 0 ]]; then
    if [[ "${CI_STRICT_SONAR:-false}" == "true" ]]; then
      echo "[lint:backend] SonarQube scan failed with exit code ${sonar_status}; strict mode enabled (CI_STRICT_SONAR=true)."
      exit ${sonar_status}
    fi

    echo "[lint:backend] SonarQube scan failed with exit code ${sonar_status}; continuing (non-blocking mode)."
  fi
else
  echo "[lint:backend] Skipping SonarQube scan (set LINT_RUN_SONAR=true to enable)."
fi

exit "$lint_status"
