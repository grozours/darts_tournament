#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="${ROOT_DIR}/frontend"
cd "${ROOT_DIR}"

if [[ -z "${DATABASE_URL:-}" && -f "${ROOT_DIR}/backend/.env" ]]; then
  db_line="$(grep -E '^DATABASE_URL=' "${ROOT_DIR}/backend/.env" | tail -n 1 || true)"
  if [[ -n "${db_line}" ]]; then
    db_value="${db_line#DATABASE_URL=}"
    db_value="${db_value%\"}"
    db_value="${db_value#\"}"
    export DATABASE_URL="${db_value}"
    echo "[playwright] Loaded DATABASE_URL from backend/.env"
  fi
fi

# In local IDE sessions, CI can be inherited and force Playwright to refuse
# reusing existing servers. We explicitly unset it for reliable local runs.
run_playwright_local() {
  (
    cd "${FRONTEND_DIR}"
    env -u CI npx playwright test -c ./playwright.config.ts "$@"
  )
}

EXTRA_ARGS=("$@")

echo "[playwright] Running backend E2E suite (tests/e2e)..."
run_playwright_local ../tests/e2e "${EXTRA_ARGS[@]}"

echo "[playwright] Running frontend E2E suite (frontend/tests/e2e)..."
run_playwright_local ./tests/e2e "${EXTRA_ARGS[@]}"

echo "[playwright] All requested Playwright suites passed."
