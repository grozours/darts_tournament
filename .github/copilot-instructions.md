# Copilot Guardrails

These instructions are mandatory for coverage work in this repository.

## Coverage Rules

- Never run full backend coverage unless the user explicitly asks for it.
- When a file is modified, run coverage only for that file with `--collectCoverageFrom=<file>`.
- When a file is modified, run tests only for that file's related test scope, never the full repository test suite.
- When a file is modified, never run repository-wide coverage or repository-wide test commands.
- Ensure newly added code is covered by tests at a minimum of 90% coverage.
- Do not use `npm run test:coverage` for routine iteration.
- Before each test/coverage command, state the exact command to execute.
- After each test/coverage run, report at least:
  - `Test Suites`
  - The test file pattern that was run
  - The exact `--collectCoverageFrom` target
- If a requested command conflicts with these rules, stop and ask for explicit confirmation.

## Safety Check Before Running Coverage

- Confirm there is exactly one `--collectCoverageFrom` path.
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
