#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"${ROOT_DIR}/scripts/check_shared_source_artifacts.sh"
"${ROOT_DIR}/scripts/non_regression.sh"
"${ROOT_DIR}/scripts/lint_all.sh"
"${ROOT_DIR}/scripts/verify_nav_links.sh"

echo "[ci] Running end-to-end tests..."
npx playwright test "${ROOT_DIR}/tests/e2e" "${ROOT_DIR}/frontend/tests/e2e"

if [[ -z "${SONAR_TOKEN:-}" ]]; then
	if [[ -f "${ROOT_DIR}/.sonar-token" ]]; then
		SONAR_TOKEN="$(cat "${ROOT_DIR}/.sonar-token")"
		export SONAR_TOKEN
	fi
fi

if [[ -n "${SONAR_TOKEN:-}" ]]; then
	"${ROOT_DIR}/scripts/sonar_scan.sh"
else
	echo "[ci] SONAR_TOKEN not set; skipping SonarQube scan."
fi
