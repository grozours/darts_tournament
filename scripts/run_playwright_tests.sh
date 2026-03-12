#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="${ROOT_DIR}/frontend"
cd "${ROOT_DIR}"

BACKEND_DEV_URL="${PLAYWRIGHT_DEV_BACKEND_URL:-http://localhost:3310/health}"
FRONTEND_DEV_URL="${PLAYWRIGHT_DEV_FRONTEND_URL:-http://localhost:3311}"
DEV_HEALTH_TRIES="${PLAYWRIGHT_DEV_HEALTH_TRIES:-20}"
DEV_HEALTH_DELAY_SECONDS="${PLAYWRIGHT_DEV_HEALTH_DELAY_SECONDS:-2}"
BACKEND_DEV_COMMAND="${PLAYWRIGHT_BACKEND_DEV_COMMAND:-PORT=3310 RATE_LIMIT_ENABLED=false AUTH_ENABLED=false CORS_ORIGINS=http://localhost:3311 npm --prefix backend run dev}"
FRONTEND_DEV_COMMAND="${PLAYWRIGHT_FRONTEND_DEV_COMMAND:-npm --prefix frontend run dev -- --host 127.0.0.1 --port 3311}"
PLAYWRIGHT_PROJECT="${PLAYWRIGHT_PROJECT:-chromium}"
BACKEND_STARTED_BY_SCRIPT="false"
FRONTEND_STARTED_BY_SCRIPT="false"
BACKEND_PID=""
FRONTEND_PID=""

sanitize_shell_command() {
  # Replace Unicode spaces that can break command parsing (e.g. non-breaking spaces).
  local command="$1"
  printf '%s' "$command" | sed -e 's/\xC2\xA0/ /g' -e 's/\xE2\x80\x89/ /g' -e 's/\xE2\x80\xAF/ /g'
}

cleanup_started_dev_processes() {
  if [[ "${BACKEND_STARTED_BY_SCRIPT}" == "true" && -n "${BACKEND_PID}" ]]; then
    kill "${BACKEND_PID}" >/dev/null 2>&1 || true
  fi
  if [[ "${FRONTEND_STARTED_BY_SCRIPT}" == "true" && -n "${FRONTEND_PID}" ]]; then
    kill "${FRONTEND_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup_started_dev_processes EXIT

wait_for_dev_health() {
  local backend_ok="false"
  local frontend_ok="false"

  for ((attempt=1; attempt<=DEV_HEALTH_TRIES; attempt++)); do
    if curl -sSf "${BACKEND_DEV_URL}" >/dev/null 2>&1; then
      backend_ok="true"
    fi
    if curl -sSf "${FRONTEND_DEV_URL}" >/dev/null 2>&1; then
      frontend_ok="true"
    fi

    if [[ "${backend_ok}" == "true" && "${frontend_ok}" == "true" ]]; then
      echo "[playwright] Dev instance is healthy (backend + frontend)."
      return 0
    fi

    if (( attempt < DEV_HEALTH_TRIES )); then
      echo "[playwright] Waiting for dev health... (${attempt}/${DEV_HEALTH_TRIES})"
      sleep "${DEV_HEALTH_DELAY_SECONDS}"
    fi
  done

  echo "[playwright] ERROR: dev instance health-check failed."
  echo "[playwright] Backend URL: ${BACKEND_DEV_URL}"
  echo "[playwright] Frontend URL: ${FRONTEND_DEV_URL}"
  return 1
}

start_dev_instance_if_enabled() {
  if [[ "${PLAYWRIGHT_BOOTSTRAP_DEV_INSTANCE:-true}" != "true" ]]; then
    echo "[playwright] Skipping dev bootstrap (PLAYWRIGHT_BOOTSTRAP_DEV_INSTANCE!=true)."
    return 0
  fi

  if curl -sSf "${BACKEND_DEV_URL}" >/dev/null 2>&1 && curl -sSf "${FRONTEND_DEV_URL}" >/dev/null 2>&1; then
    echo "[playwright] Reusing existing local dev instance (${BACKEND_DEV_URL}, ${FRONTEND_DEV_URL})."
    return 0
  fi

  BACKEND_DEV_COMMAND="$(sanitize_shell_command "${BACKEND_DEV_COMMAND}")"
  FRONTEND_DEV_COMMAND="$(sanitize_shell_command "${FRONTEND_DEV_COMMAND}")"

  echo "[playwright] Starting backend dev on 3310..."
  bash -lc "cd \"${ROOT_DIR}\" && ${BACKEND_DEV_COMMAND}" >/tmp/playwright-backend-dev.log 2>&1 &
  BACKEND_PID="$!"
  BACKEND_STARTED_BY_SCRIPT="true"

  echo "[playwright] Starting frontend dev on 3311..."
  bash -lc "cd \"${ROOT_DIR}\" && ${FRONTEND_DEV_COMMAND}" >/tmp/playwright-frontend-dev.log 2>&1 &
  FRONTEND_PID="$!"
  FRONTEND_STARTED_BY_SCRIPT="true"

  wait_for_dev_health
}

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
  local project_args=()
  if [[ -n "${PLAYWRIGHT_PROJECT}" ]]; then
    project_args+=(--project "${PLAYWRIGHT_PROJECT}")
  fi

  (
    cd "${FRONTEND_DIR}"
    env -u CI npx playwright test "$@" -c ./playwright.config.ts "${project_args[@]}"
  )
}

EXTRA_ARGS=("$@")

start_dev_instance_if_enabled

echo "[playwright] Running backend E2E suite (tests/e2e)..."
run_playwright_local ../tests/e2e "${EXTRA_ARGS[@]}"

echo "[playwright] Running frontend E2E suite (frontend/tests/e2e)..."
run_playwright_local ./tests/e2e "${EXTRA_ARGS[@]}"

echo "[playwright] All requested Playwright suites passed."
