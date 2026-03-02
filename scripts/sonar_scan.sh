#!/usr/bin/env bash
set -euo pipefail

SONAR_HOST_URL=${SONAR_HOST_URL:-http://localhost:9000}
SONAR_TOKEN=${SONAR_TOKEN:-}
SONAR_DISABLE_SCM=${SONAR_DISABLE_SCM:-0}
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SONAR_TOKEN_FILE="$ROOT_DIR/.sonar-token"

if [[ -z "$SONAR_TOKEN" ]]; then
  if [[ -f "$SONAR_TOKEN_FILE" ]]; then
    SONAR_TOKEN="$(tr -d '\r\n' < "$SONAR_TOKEN_FILE")"
  fi
fi

if [[ -z "$SONAR_TOKEN" ]]; then
  echo "SONAR_TOKEN is required (set SONAR_TOKEN or provide .sonar-token in repo root)"
  exit 1
fi

if git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if [[ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]]; then
    echo "[sonar] WARNING: repository contains uncommitted changes."
    echo "[sonar] SonarQube may report 'Missing blame information' for modified/untracked files."
    echo "[sonar] For full SCM features, commit changes first, then re-run this scan."
  fi
fi

SONAR_EXTRA_ARGS=()
if [[ "$SONAR_DISABLE_SCM" == "1" ]]; then
  echo "[sonar] SCM integration disabled (SONAR_DISABLE_SCM=1)."
  SONAR_EXTRA_ARGS+=("-Dsonar.scm.disabled=true")
fi

docker run --rm \
  --network host \
  -w /usr/src \
  -e SONAR_HOST_URL="$SONAR_HOST_URL" \
  -v "$ROOT_DIR:/usr/src" \
  sonarsource/sonar-scanner-cli \
  -Dsonar.login="$SONAR_TOKEN" \
  -Dsonar.projectKey="darts-tournament" \
  -Dsonar.qualitygate.wait=true \
  -Dsonar.qualitygate.timeout=300 \
  "${SONAR_EXTRA_ARGS[@]}"
