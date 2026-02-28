import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

const threshold = {
  statements: 80,
  branches: 80,
  functions: 80,
  lines: 80,
};

const coverageFinalPath = path.join(frontendRoot, 'coverage', 'coverage-final.json');
const lcovPath = path.join(frontendRoot, 'coverage', 'lcov.info');

if (!fs.existsSync(coverageFinalPath) || !fs.existsSync(lcovPath)) {
  console.error('[coverage] Missing coverage artifacts. Run coverage before threshold check.');
  process.exit(1);
}

const coverageFinal = JSON.parse(fs.readFileSync(coverageFinalPath, 'utf8'));

let statementTotal = 0;
let statementCovered = 0;

for (const fileCoverage of Object.values(coverageFinal)) {
  if (!fileCoverage || typeof fileCoverage !== 'object') {
    continue;
  }
  const statements = fileCoverage.s;
  if (!statements || typeof statements !== 'object') {
    continue;
  }
  for (const hits of Object.values(statements)) {
    statementTotal += 1;
    if (typeof hits === 'number' && hits > 0) {
      statementCovered += 1;
    }
  }
}

const lcovText = fs.readFileSync(lcovPath, 'utf8');
const lines = lcovText.split(/\r?\n/);

let lineTotal = 0;
let lineCovered = 0;
let functionTotal = 0;
let functionCovered = 0;
let branchTotal = 0;
let branchCovered = 0;

for (const line of lines) {
  if (line.startsWith('LF:')) {
    lineTotal += Number(line.slice(3)) || 0;
  } else if (line.startsWith('LH:')) {
    lineCovered += Number(line.slice(3)) || 0;
  } else if (line.startsWith('FNF:')) {
    functionTotal += Number(line.slice(4)) || 0;
  } else if (line.startsWith('FNH:')) {
    functionCovered += Number(line.slice(4)) || 0;
  } else if (line.startsWith('BRF:')) {
    branchTotal += Number(line.slice(4)) || 0;
  } else if (line.startsWith('BRH:')) {
    branchCovered += Number(line.slice(4)) || 0;
  }
}

const safePct = (covered, total) => (total === 0 ? 100 : (covered / total) * 100);

const metrics = {
  statements: safePct(statementCovered, statementTotal),
  branches: safePct(branchCovered, branchTotal),
  functions: safePct(functionCovered, functionTotal),
  lines: safePct(lineCovered, lineTotal),
};

const failures = Object.entries(threshold)
  .filter(([key, min]) => metrics[key] < min)
  .map(([key, min]) => `${key} ${metrics[key].toFixed(2)}% < ${min}%`);

console.log(
  `[coverage] statements=${metrics.statements.toFixed(2)}% branches=${metrics.branches.toFixed(2)}% functions=${metrics.functions.toFixed(2)}% lines=${metrics.lines.toFixed(2)}%`
);

if (failures.length > 0) {
  console.error('[coverage] Threshold check failed:');
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log('[coverage] Threshold check passed.');
