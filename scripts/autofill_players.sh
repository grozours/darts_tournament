#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

compose_cmd="docker compose"

original_auth_enabled="$(grep -E '^AUTH_ENABLED=' backend/.env | tail -n1 | cut -d= -f2 || true)"

restore_auth() {
  if [[ -n "${original_auth_enabled}" ]]; then
    sed -i -E "s/^AUTH_ENABLED=.*/AUTH_ENABLED=${original_auth_enabled}/" backend/.env
  fi
}

trap restore_auth EXIT

if [[ "${original_auth_enabled}" != "false" ]]; then
  echo "Temporarily disabling auth for player autofill..."
  sed -i -E 's/^AUTH_ENABLED=.*/AUTH_ENABLED=false/' backend/.env
  $compose_cmd up -d backend
fi

echo "Waiting for backend to be ready..."
ready=false
for i in {1..30}; do
  if curl -s -o /dev/null -w '%{http_code}' "http://localhost:3000/api/tournaments?limit=1" | grep -q '^200$'; then
    ready=true
    break
  fi
  sleep 1
  if [[ "$i" == "30" ]]; then
    echo "Backend did not become ready in time." >&2
  fi
done

if [[ "$ready" != "true" ]]; then
  exit 1
fi

echo "Autofilling players and activating T2..."
REGISTRATION_EMPTY_SLOTS=5 API_BASE="http://localhost:3000" node ./scripts/autofill_players.mjs

if [[ "${original_auth_enabled}" != "false" ]]; then
  echo "Re-enabling auth..."
  restore_auth
  $compose_cmd up -d backend
fi
