#!/usr/bin/env bash
set -euo pipefail

SONAR_HOST_URL=${SONAR_HOST_URL:-http://localhost:9000}
SONAR_TOKEN=${SONAR_TOKEN:-}
SONAR_DISABLE_SCM=${SONAR_DISABLE_SCM:-0}
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SONAR_TOKEN_FILE="$ROOT_DIR/.sonar-token"
BACKEND_LCOV_ORIGINAL="$ROOT_DIR/backend/coverage/lcov.info"
FRONTEND_LCOV_ORIGINAL="$ROOT_DIR/frontend/coverage/lcov.info"

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

TMP_DIR="$(mktemp -d "$ROOT_DIR/.sonar-tmp.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

BACKEND_LCOV_FOR_SCAN="$BACKEND_LCOV_ORIGINAL"
FRONTEND_LCOV_FOR_SCAN="$FRONTEND_LCOV_ORIGINAL"

if [[ -f "$BACKEND_LCOV_ORIGINAL" ]]; then
  BACKEND_LCOV_FOR_SCAN="$TMP_DIR/backend.lcov.info"
  cp "$BACKEND_LCOV_ORIGINAL" "$BACKEND_LCOV_FOR_SCAN"
fi

if [[ -f "$FRONTEND_LCOV_ORIGINAL" ]]; then
  FRONTEND_LCOV_FOR_SCAN="$TMP_DIR/frontend.lcov.info"
  awk '
    function flush_record() {
      if (keep_record && record != "") {
        printf "%s", record;
      }
      record = "";
      keep_record = 1;
    }

    BEGIN {
      record = "";
      keep_record = 1;
    }

    {
      line = $0;
      if (line ~ /^SF:/) {
        path = substr(line, 4);
        if (path ~ /^tests\//) {
          path = "frontend/" path;
          line = "SF:" path;
        }

        if (path ~ /^frontend\/tests\// && path !~ /\.test\.tsx?$/ && path !~ /\.spec\.tsx?$/) {
          keep_record = 0;
        }
      }

      record = record line ORS;

      if (line == "end_of_record") {
        flush_record();
      }
    }

    END {
      flush_record();
    }
  ' "$FRONTEND_LCOV_ORIGINAL" > "$FRONTEND_LCOV_FOR_SCAN"
fi

LCOV_REPORT_PATHS=()
if [[ -f "$BACKEND_LCOV_FOR_SCAN" ]]; then
  LCOV_REPORT_PATHS+=("${BACKEND_LCOV_FOR_SCAN#$ROOT_DIR/}")
fi
if [[ -f "$FRONTEND_LCOV_FOR_SCAN" ]]; then
  LCOV_REPORT_PATHS+=("${FRONTEND_LCOV_FOR_SCAN#$ROOT_DIR/}")
fi

if [[ ${#LCOV_REPORT_PATHS[@]} -gt 0 ]]; then
  SONAR_EXTRA_ARGS+=("-Dsonar.javascript.lcov.reportPaths=$(IFS=,; echo "${LCOV_REPORT_PATHS[*]}")")
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
