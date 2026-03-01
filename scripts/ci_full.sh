#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"${ROOT_DIR}/scripts/check_shared_source_artifacts.sh"
"${ROOT_DIR}/scripts/non_regression.sh"
"${ROOT_DIR}/scripts/lint_all.sh"
"${ROOT_DIR}/scripts/verify_nav_links.sh"
bash "${ROOT_DIR}/scripts/verify_docs_links.sh"

echo "[ci] Running backend coverage tests..."
npm --prefix "${ROOT_DIR}/backend" run test:coverage

echo "[ci] Running frontend coverage tests..."
npm --prefix "${ROOT_DIR}/frontend" run test:coverage

echo "[ci] Running end-to-end tests..."
if [[ "${CI_UPDATE_DOC_SCREENSHOTS:-false}" == "true" ]]; then
	export UPDATE_DOC_SCREENSHOTS=true
	echo "[ci] Documentation screenshots update enabled (CI_UPDATE_DOC_SCREENSHOTS=true)."
else
	export UPDATE_DOC_SCREENSHOTS=false
	echo "[ci] Documentation screenshots update disabled by default."
fi
bash "${ROOT_DIR}/scripts/run_playwright_tests.sh"

if [[ -z "${SONAR_TOKEN:-}" ]]; then
	if [[ -f "${ROOT_DIR}/.sonar-token" ]]; then
		SONAR_TOKEN="$(cat "${ROOT_DIR}/.sonar-token")"
		export SONAR_TOKEN
	fi
fi

if [[ -n "${SONAR_TOKEN:-}" ]]; then
	sonar_status=0
	"${ROOT_DIR}/scripts/sonar_scan.sh" || sonar_status=$?

	if [[ ${sonar_status} -eq 0 ]]; then
		echo "[ci] SonarQube scan completed."
	elif [[ "${CI_STRICT_SONAR:-false}" == "true" ]]; then
		echo "[ci] SonarQube scan failed with exit code ${sonar_status}; strict mode enabled (CI_STRICT_SONAR=true)."
		exit ${sonar_status}
	else
		echo "[ci] SonarQube scan failed with exit code ${sonar_status}; continuing (non-blocking mode)."
	fi
else
	echo "[ci] SONAR_TOKEN not set; skipping SonarQube scan."
fi
