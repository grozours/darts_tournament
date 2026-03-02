#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .sonar-token ]]; then
  echo "[error] Missing .sonar-token in $ROOT_DIR" >&2
  exit 1
fi

SONAR_TOKEN="$(tr -d '[:space:]' < .sonar-token)"
if [[ -z "$SONAR_TOKEN" ]]; then
  echo "[error] Empty SONAR token" >&2
  exit 1
fi

node - <<'NODE'
const fs = require('fs');
const token = fs.readFileSync('.sonar-token', 'utf8').trim();
const auth = `Basic ${Buffer.from(`${token}:`).toString('base64')}`;
const base = process.env.SONAR_HOST_URL || 'http://localhost:9000';
const projectKey = process.env.SONAR_PROJECT_KEY || 'darts-tournament';

async function api(path) {
  const response = await fetch(`${base}${path}`, { headers: { Authorization: auth } });
  if (!response.ok) throw new Error(`${response.status} ${path}`);
  return response.json();
}

(async () => {
  const metricKeys = [
    'duplicated_lines',
    'duplicated_blocks',
    'duplicated_lines_density',
    'new_duplicated_lines',
    'new_duplicated_blocks',
    'new_duplicated_lines_density',
    'alert_status',
    'quality_gate_details',
  ].join(',');

  const component = await api(`/api/measures/component?component=${encodeURIComponent(projectKey)}&metricKeys=${metricKeys}`);
  const measures = Object.fromEntries((component.component?.measures ?? []).map((m) => [m.metric, m]));

  const duplicatedLinesDensity = Number(measures.duplicated_lines_density?.value ?? 0);
  const duplicatedLines = Number(measures.duplicated_lines?.value ?? 0);
  const duplicatedBlocks = Number(measures.duplicated_blocks?.value ?? 0);

  const newDuplicatedLinesDensity = Number(measures.new_duplicated_lines_density?.period?.value ?? 0);
  const newDuplicatedLines = Number(measures.new_duplicated_lines?.period?.value ?? 0);
  const newDuplicatedBlocks = Number(measures.new_duplicated_blocks?.period?.value ?? 0);

  const alertStatus = measures.alert_status?.value ?? 'UNKNOWN';

  console.log(`QUALITY_GATE=${alertStatus}`);
  console.log(`OVERALL_DUPLICATION=${duplicatedLinesDensity.toFixed(2)}% (lines=${duplicatedLines}, blocks=${duplicatedBlocks})`);
  console.log(`NEW_CODE_DUPLICATION=${newDuplicatedLinesDensity.toFixed(2)}% (lines=${newDuplicatedLines}, blocks=${newDuplicatedBlocks})`);

  const tree = await api(`/api/measures/component_tree?component=${encodeURIComponent(projectKey)}&metricKeys=new_duplicated_lines,new_duplicated_blocks,new_duplicated_lines_density&qualifiers=FIL&ps=500&p=1`);
  const rows = (tree.components ?? []).map((component_) => {
    const byMetric = Object.fromEntries((component_.measures ?? []).map((m) => [m.metric, Number(m.period?.value ?? m.value ?? 0)]));
    return {
      path: component_.path,
      density: byMetric.new_duplicated_lines_density || 0,
      lines: byMetric.new_duplicated_lines || 0,
      blocks: byMetric.new_duplicated_blocks || 0,
    };
  }).filter((row) => row.density > 0 || row.lines > 0 || row.blocks > 0)
    .sort((a, b) => (b.density - a.density) || (b.lines - a.lines));

  if (rows.length === 0) {
    console.log('NEW_CODE_DUPLICATION_TOP_FILES=none');
    return;
  }

  console.log('NEW_CODE_DUPLICATION_TOP_FILES');
  for (const row of rows.slice(0, 10)) {
    console.log(`- ${row.density.toFixed(2)}% | lines=${row.lines} | blocks=${row.blocks} | ${row.path}`);
  }
})();
NODE
