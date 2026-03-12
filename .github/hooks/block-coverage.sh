#!/usr/bin/env bash
set -euo pipefail

payload=$(cat)

# If payload cannot be parsed, do not block by default.
if ! printf '%s' "$payload" | jq -e . >/dev/null 2>&1; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
  exit 0
fi

tool_name=$(printf '%s' "$payload" | jq -r '.toolName // .tool_name // ""')
cmd=$(printf '%s' "$payload" | jq -r '.toolInput.command // .tool_input.command // ""')

if [[ "$tool_name" != "run_in_terminal" ]] || [[ -z "$cmd" ]]; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
  exit 0
fi

if [[ "$cmd" =~ npm[[:space:]]+run[[:space:]]+test:coverage ]]; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked: full coverage command is forbidden. Use targeted Jest + --collectCoverageFrom=<file>."}}'
  exit 2
fi

if [[ "$cmd" =~ jest ]] && [[ "$cmd" =~ --coverage ]] && [[ ! "$cmd" =~ --collectCoverageFrom= ]]; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked: coverage command missing --collectCoverageFrom=<file>."}}'
  exit 2
fi

echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
