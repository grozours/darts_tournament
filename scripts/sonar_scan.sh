#!/usr/bin/env bash
set -euo pipefail

SONAR_HOST_URL=${SONAR_HOST_URL:-http://localhost:9000}
SONAR_TOKEN=${SONAR_TOKEN:-}
SONAR_DISABLE_SCM=${SONAR_DISABLE_SCM:-0}
SONAR_PROJECT_KEY=${SONAR_PROJECT_KEY:-darts-tournament}
SONAR_SUMMARY_FORMAT=${SONAR_SUMMARY_FORMAT:-text}
SONAR_RUN_COVERAGE=${SONAR_RUN_COVERAGE:-1}
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

run_coverage_reports() {
  echo "[sonar] Generating backend coverage report..."
  DATABASE_URL=' ' npm --prefix "$ROOT_DIR/backend" run test:coverage -- tests/unit --runInBand

  echo "[sonar] Generating frontend coverage report..."
  npm --prefix "$ROOT_DIR/frontend" run test:coverage:raw
}

if [[ "$SONAR_RUN_COVERAGE" == "1" ]]; then
  run_coverage_reports
else
  echo "[sonar] Coverage generation skipped (SONAR_RUN_COVERAGE=$SONAR_RUN_COVERAGE)."
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

set +e
docker run --rm \
  --network host \
  -w /usr/src \
  -e SONAR_HOST_URL="$SONAR_HOST_URL" \
  -v "$ROOT_DIR:/usr/src" \
  sonarsource/sonar-scanner-cli \
  -Dsonar.login="$SONAR_TOKEN" \
  -Dsonar.projectKey="$SONAR_PROJECT_KEY" \
  -Dsonar.qualitygate.wait=true \
  -Dsonar.qualitygate.timeout=300 \
  "${SONAR_EXTRA_ARGS[@]}"
SCAN_EXIT_CODE=$?
set -e

set +e
SONAR_HOST_URL="$SONAR_HOST_URL" SONAR_TOKEN="$SONAR_TOKEN" SONAR_PROJECT_KEY="$SONAR_PROJECT_KEY" SONAR_SUMMARY_FORMAT="$SONAR_SUMMARY_FORMAT" node - <<'NODE'
const base = process.env.SONAR_HOST_URL || 'http://localhost:9000';
const token = process.env.SONAR_TOKEN || '';
const projectKey = process.env.SONAR_PROJECT_KEY || 'darts-tournament';
const summaryFormat = (process.env.SONAR_SUMMARY_FORMAT || 'text').toLowerCase();

if (!token) {
  console.log('[sonar] API summary skipped: missing SONAR_TOKEN');
  process.exit(0);
}

const auth = `Basic ${Buffer.from(`${token}:`).toString('base64')}`;

async function api(path) {
  const response = await fetch(`${base}${path}`, {
    headers: {
      Authorization: auth,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${path}`);
  }

  return response.json();
}

async function fetchIssueCount(extraQuery = '') {
  const payload = await api(`/api/issues/search?componentKeys=${encodeURIComponent(projectKey)}&resolved=false&ps=1${extraQuery}`);
  return Number(payload.total ?? 0);
}

async function fetchCoverageMeasures() {
  const payload = await api(`/api/measures/component?component=${encodeURIComponent(projectKey)}&metricKeys=coverage,new_coverage,lines_to_cover,new_lines_to_cover,uncovered_lines,new_uncovered_lines`);
  const measures = payload.component?.measures ?? [];
  const toNumber = (key) => Number((measures.find((measure) => measure.metric === key)?.value) ?? 0);
  return {
    coverage: toNumber('coverage'),
    newCoverage: toNumber('new_coverage'),
    linesToCover: toNumber('lines_to_cover'),
    newLinesToCover: toNumber('new_lines_to_cover'),
    uncoveredLines: toNumber('uncovered_lines'),
    newUncoveredLines: toNumber('new_uncovered_lines'),
  };
}

async function fetchHotspotCount(extraQuery = '') {
  const payload = await api(`/api/hotspots/search?projectKey=${encodeURIComponent(projectKey)}&ps=1${extraQuery}`);
  return Number(payload.paging?.total ?? 0);
}

function measureValue(measures, key) {
  const found = measures.find((measure) => measure.metric === key);
  return Number(found?.value ?? found?.period?.value ?? 0);
}

(async () => {
  const component = await api(`/api/measures/component?component=${encodeURIComponent(projectKey)}&metricKeys=duplicated_lines,duplicated_blocks,duplicated_lines_density,new_duplicated_lines,new_duplicated_blocks,new_duplicated_lines_density`);
  const measures = component.component?.measures ?? [];

  const duplicatedLines = measureValue(measures, 'duplicated_lines');
  const duplicatedBlocks = measureValue(measures, 'duplicated_blocks');
  const duplicatedDensity = measureValue(measures, 'duplicated_lines_density');
  const newDuplicatedLines = measureValue(measures, 'new_duplicated_lines');
  const newDuplicatedBlocks = measureValue(measures, 'new_duplicated_blocks');
  const newDuplicatedDensity = measureValue(measures, 'new_duplicated_lines_density');

  const [
    hotspotsTotal,
    hotspotsToReview,
    hotspotsReviewed,
    issuesTotal,
    codeSmellsTotal,
    coverage,
  ] = await Promise.all([
    fetchHotspotCount(),
    fetchHotspotCount('&status=TO_REVIEW'),
    fetchHotspotCount('&status=REVIEWED'),
    fetchIssueCount(),
    fetchIssueCount('&types=CODE_SMELL'),
    fetchCoverageMeasures(),
  ]);

  if (summaryFormat === 'json') {
    console.log(JSON.stringify({
      projectKey,
      hotspots: {
        total: hotspotsTotal,
        toReview: hotspotsToReview,
        reviewed: hotspotsReviewed,
      },
      duplication: {
        overall: {
          density: Number(duplicatedDensity.toFixed(2)),
          lines: duplicatedLines,
          blocks: duplicatedBlocks,
        },
        newCode: {
          density: Number(newDuplicatedDensity.toFixed(2)),
          lines: newDuplicatedLines,
          blocks: newDuplicatedBlocks,
        },
      },
      coverage: {
        overall: Number(coverage.coverage.toFixed(2)),
        newCode: Number(coverage.newCoverage.toFixed(2)),
        linesToCover: coverage.linesToCover,
        newLinesToCover: coverage.newLinesToCover,
        uncoveredLines: coverage.uncoveredLines,
        newUncoveredLines: coverage.newUncoveredLines,
      },
      issues: {
        total: issuesTotal,
      },
      codeSmells: {
        total: codeSmellsTotal,
      },
    }));
    return;
  }

  console.log('SONAR_API_SUMMARY');
  console.log(`HOTSPOTS total=${hotspotsTotal} to_review=${hotspotsToReview} reviewed=${hotspotsReviewed}`);
  console.log(`DUPLICATION overall=${duplicatedDensity.toFixed(2)}% lines=${duplicatedLines} blocks=${duplicatedBlocks}`);
  console.log(`DUPLICATION_NEW ${newDuplicatedDensity.toFixed(2)}% lines=${newDuplicatedLines} blocks=${newDuplicatedBlocks}`);
  console.log(`COVERAGE overall=${coverage.coverage.toFixed(2)}% lines_to_cover=${coverage.linesToCover} uncovered=${coverage.uncoveredLines}`);
  console.log(`COVERAGE_NEW ${coverage.newCoverage.toFixed(2)}% lines_to_cover=${coverage.newLinesToCover} uncovered=${coverage.newUncoveredLines}`);
  console.log(`ISSUES total=${issuesTotal}`);
  console.log(`CODE_SMELLS total=${codeSmellsTotal}`);
})().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.log(`[sonar] API summary failed: ${message}`);
  process.exit(1);
});
NODE
API_EXIT_CODE=$?
set -e

if [[ $API_EXIT_CODE -ne 0 ]]; then
  echo "[sonar] API summary unavailable; scan result preserved." >&2
fi

exit $SCAN_EXIT_CODE
