#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() {
  echo "[non-regression] $*"
}

log "Running backend tests..."
cd "$ROOT_DIR/backend"
npm test

log "Running frontend tests..."
cd "$ROOT_DIR/frontend"
npm run test -- --run

log "Non-regression test suite completed successfully."
