#!/usr/bin/env bash
set -euo pipefail

cat <<'JSON'
{
  "systemMessage": "Compliance check required before any tool use: read .github/copilot-instructions.md, .github/agents/coverage-strict.agent.md, and .github/hooks/coverage-guard.json, then provide a short compliance summary and wait for explicit user OK.",
  "continue": true
}
JSON
