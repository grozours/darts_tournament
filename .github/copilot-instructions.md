# Copilot Guardrails

These instructions are mandatory for coverage work in this repository.

## Coverage Rules

### Backend (Jest)

- Never run full backend coverage unless the user explicitly asks for it.
- When a file is modified, run coverage only for that file with `--collectCoverageFrom=<file>`.
- When a file is modified, run tests only for that file's related test scope, never the full repository test suite.
- When a file is modified, never run repository-wide coverage or repository-wide test commands.
- Do not use `npm run test:coverage` for routine iteration.

### Frontend (Vitest)

- Never run full frontend coverage unless the user explicitly asks for it.
- When a file is modified, run coverage only for that file with `--coverage.include=<file>`.
- When a file is modified, run tests only for that file's related test scope, never the full repository test suite.
- When a file is modified, never run repository-wide coverage or repository-wide test commands.
- Do not use `npm --prefix frontend run test:coverage` or `npm --prefix frontend run test:coverage:raw` for routine iteration.

### Shared Coverage Rules

- Ensure newly added code is covered by tests at a minimum of 90% coverage.
- Before each test/coverage command, state the exact command to execute.
- After each test/coverage run, report at least:
  - Backend: `Test Suites`, test file pattern, exact `--collectCoverageFrom` target.
  - Frontend: `Test Files`, test file pattern, exact `--coverage.include` target.
- If a requested command conflicts with these rules, stop and ask for explicit confirmation.

## Safety Check Before Running Coverage

- Backend: confirm there is exactly one `--collectCoverageFrom` path.
- Frontend: confirm there is exactly one `--coverage.include` path.
- Confirm the test command targets specific test file(s), not the full suite.

## Code Quality Rules

- Always fix code issues at the source; do not hide anomalies.
- Never change linter configuration to suppress or bypass findings.
- Never weaken quality gates (lint, typecheck, tests) to make code appear healthy.
- Do not add broad ignore directives (`eslint-disable`, `ts-ignore`, rule downgrades) unless the user explicitly requests it and the reason is documented in code.
- Prefer long-term maintainability over short-term workaround patches.
- Continue work on the same file once started; even if the task is long, do not switch files until the requested work on that file is fully complete.

## IDE Problem Monitoring

- Regularly check IDE problems during implementation (for example after meaningful edits).
- If IDE problems are detected in touched files, correct them before considering the task complete.
