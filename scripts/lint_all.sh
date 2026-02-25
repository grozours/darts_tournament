#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT_DIR/scripts/check_shared_source_artifacts.sh"
"$ROOT_DIR/scripts/lint_frontend.sh" "$@"
"$ROOT_DIR/scripts/lint_backend.sh" "$@"
