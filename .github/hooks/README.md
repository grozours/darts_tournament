# Hooks Guardrails

This folder contains deterministic Copilot hooks used to enforce backend coverage rules.

## Files

- `coverage-guard.json`: hook wiring for `SessionStart` and `PreToolUse`
- `session-start-reminder.sh`: injects a compliance reminder at session start
- `block-coverage.sh`: blocks forbidden coverage commands before terminal execution

## Policy Enforced

- No full backend coverage runs during normal iteration.
- Coverage commands must use exactly one `--collectCoverageFrom=<file>` target.
- Agent must provide explicit compliance summary before running commands.

## Quick Verification

1. Validate hook JSON:
   - `jq . .github/hooks/coverage-guard.json`
2. Validate executable permissions:
   - `ls -l .github/hooks/block-coverage.sh .github/hooks/session-start-reminder.sh`
3. Manual guard check (script-level):
   - `echo '{"toolName":"run_in_terminal","toolInput":{"command":"npm run test:coverage"}}' | .github/hooks/block-coverage.sh`
   - Expected: deny decision (non-zero exit)
4. Manual allow check (script-level):
   - `echo '{"toolName":"run_in_terminal","toolInput":{"command":"npx jest tests/unit/core-handlers-branch-coverage.test.ts --coverage --collectCoverageFrom=src/services/tournament-service/core-handlers.ts"}}' | .github/hooks/block-coverage.sh`
   - Expected: allow decision (exit 0)

## Notes

- Hook enforcement depends on the client loading workspace hooks.
- Keep scripts small, deterministic, and reviewable.
