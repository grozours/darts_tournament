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

echo "Stopping stack and wiping volumes..."
$compose_cmd down -v

echo "Starting stack..."
$compose_cmd up -d

echo "Running migrations..."
$compose_cmd exec -T backend npm run db:migrate

echo "Updating enum values if needed..."
$compose_cmd exec -T postgres psql -U darts_user -d darts_tournament -c "ALTER TYPE tournament_status ADD VALUE IF NOT EXISTS 'OPEN';"
$compose_cmd exec -T postgres psql -U darts_user -d darts_tournament -c "ALTER TYPE tournament_status ADD VALUE IF NOT EXISTS 'SIGNATURE';"
$compose_cmd exec -T postgres psql -U darts_user -d darts_tournament -c "ALTER TYPE tournament_status ADD VALUE IF NOT EXISTS 'LIVE';"
$compose_cmd exec -T postgres psql -U darts_user -d darts_tournament -c "ALTER TYPE tournament_status ADD VALUE IF NOT EXISTS 'FINISHED';"
$compose_cmd exec -T postgres psql -U darts_user -d darts_tournament -c "ALTER TYPE stage_status ADD VALUE IF NOT EXISTS 'EDITION';"

echo "Ensuring checked_in column exists..."
$compose_cmd exec -T postgres psql -U darts_user -d darts_tournament -c "ALTER TABLE players ADD COLUMN IF NOT EXISTS checked_in BOOLEAN DEFAULT false;"

if [[ "${original_auth_enabled}" != "false" ]]; then
  echo "Temporarily disabling auth for seeding..."
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

start_time="$(date -u -d '+1 day' +%Y-%m-%dT%H:%M:%SZ)"
end_time="$(date -u -d '+2 day' +%Y-%m-%dT%H:%M:%SZ)"

echo "Creating tournaments..."
resp1=$(curl -s -X POST http://localhost:3000/api/tournaments \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Registration Cup\",\"format\":\"SINGLE\",\"durationType\":\"FULL_DAY\",\"startTime\":\"${start_time}\",\"endTime\":\"${end_time}\",\"totalParticipants\":32,\"targetCount\":9}")

t1_id=$(printf '%s' "$resp1" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const j=JSON.parse(d);console.log(j.id||"");});')

resp2=$(curl -s -X POST http://localhost:3000/api/tournaments \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Dual Stage Open\",\"format\":\"DOUBLE\",\"durationType\":\"FULL_DAY\",\"startTime\":\"${start_time}\",\"endTime\":\"${end_time}\",\"totalParticipants\":40,\"targetCount\":9}")

t2_id=$(printf '%s' "$resp2" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const j=JSON.parse(d);console.log(j.id||"");});')

if [[ -z "$t1_id" || -z "$t2_id" ]]; then
  echo "Failed to create tournaments." >&2
  echo "resp1: $resp1" >&2
  echo "resp2: $resp2" >&2
  exit 1
fi

echo "Opening registration..."
curl -s -X POST "http://localhost:3000/api/tournaments/${t1_id}/open-registration" > /dev/null
curl -s -X POST "http://localhost:3000/api/tournaments/${t2_id}/open-registration" > /dev/null

echo "Creating pool stages for dual-stage tournament..."
stage1=$(curl -s -X POST "http://localhost:3000/api/tournaments/${t2_id}/pool-stages" \
  -H 'Content-Type: application/json' \
  -d '{"stageNumber":1,"name":"Stage 1","poolCount":8,"playersPerPool":5,"advanceCount":2,"losersAdvanceToBracket":false}')

stage1_id=$(printf '%s' "$stage1" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const j=JSON.parse(d);console.log(j.id||"");});')

stage2=$(curl -s -X POST "http://localhost:3000/api/tournaments/${t2_id}/pool-stages" \
  -H 'Content-Type: application/json' \
  -d '{"stageNumber":2,"name":"Stage 2","poolCount":8,"playersPerPool":4,"advanceCount":2,"losersAdvanceToBracket":false}')

stage2_id=$(printf '%s' "$stage2" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const j=JSON.parse(d);console.log(j.id||"");});')

if [[ -z "$stage1_id" || -z "$stage2_id" ]]; then
  echo "Failed to create pool stages." >&2
  echo "stage1: $stage1" >&2
  echo "stage2: $stage2" >&2
  exit 1
fi

curl -s -X PATCH "http://localhost:3000/api/tournaments/${t2_id}/pool-stages/${stage1_id}" \
  -H 'Content-Type: application/json' \
  -d '{"status":"IN_PROGRESS"}' > /dev/null

echo "Autofilling players and activating tournaments..."
./scripts/autofill_players.sh

if [[ "${original_auth_enabled}" != "false" ]]; then
  echo "Re-enabling auth..."
  restore_auth
  $compose_cmd up -d backend
fi

cat <<EOF
Done.
Registration tournament: ${t1_id}
Dual stage tournament: ${t2_id}
Stage 1: ${stage1_id} (IN_PROGRESS)
Stage 2: ${stage2_id} (NOT_STARTED)
EOF
