#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHARED_SRC_DIR="${ROOT_DIR}/shared/src"

mapfile -t forbidden_files < <(
  find "${SHARED_SRC_DIR}" -type f \( \
    -name '*.js' -o \
    -name '*.js.map' -o \
    -name '*.d.ts' -o \
    -name '*.d.ts.map' \
  \) | sort
)

if [[ ${#forbidden_files[@]} -gt 0 ]]; then
  echo "[guard] Generated artifacts detected under shared source tree:"
  printf ' - %s\n' "${forbidden_files[@]}"
  echo "[guard] Remove these files from shared/src to avoid stale runtime imports."
  exit 1
fi

echo "[guard] shared/src is clean (no generated JS or declaration artifacts)."
