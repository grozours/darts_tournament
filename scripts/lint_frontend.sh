#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"

cd "$FRONTEND_DIR"

npm install

if [[ "${1:-}" == "--fix" ]]; then
  npm run lint:fix
else
  npm run lint
fi
