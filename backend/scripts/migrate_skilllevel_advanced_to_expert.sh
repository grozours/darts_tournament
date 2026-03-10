#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

load_database_url() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    return
  fi

  if [[ -f "${ROOT_DIR}/.env" ]]; then
    local db_line
    db_line="$(sed -n 's/^DATABASE_URL=//p' "${ROOT_DIR}/.env" | head -n1)"
    if [[ -n "${db_line}" ]]; then
      db_line="${db_line%\"}"
      db_line="${db_line#\"}"
      export DATABASE_URL="${db_line}"
      return
    fi
  fi

  echo "DATABASE_URL is not set. Export DATABASE_URL or configure backend/.env." >&2
  exit 1
}

require_psql() {
  return 0
}

SQL_RUNNER=""

detect_sql_runner() {
  if command -v psql >/dev/null 2>&1; then
    SQL_RUNNER="local"
    return
  fi

  if command -v docker >/dev/null 2>&1; then
    if docker compose ps postgres >/dev/null 2>&1; then
      SQL_RUNNER="docker-compose"
      return
    fi
  fi

  echo "Neither local psql nor docker compose postgres service is available." >&2
  echo "Install PostgreSQL client tools or run with docker compose postgres." >&2
  exit 1
}

run_sql_cmd() {
  local sql="$1"
  if [[ "${SQL_RUNNER}" == "local" ]]; then
    psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -c "${sql}"
    return
  fi

  docker compose exec -T -e DATABASE_URL="${DATABASE_URL}" postgres \
    sh -lc "psql \"\${DATABASE_URL}\" -v ON_ERROR_STOP=1 -c \"${sql}\""
}

run_sql_heredoc() {
  local sql="$1"
  if [[ "${SQL_RUNNER}" == "local" ]]; then
    psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 <<SQL
${sql}
SQL
    return
  fi

  docker compose exec -T -e DATABASE_URL="${DATABASE_URL}" postgres \
    sh -lc 'psql "${DATABASE_URL}" -v ON_ERROR_STOP=1' <<SQL
${sql}
SQL
}

print_usage() {
  cat <<'USAGE'
Usage:
  backend/scripts/migrate_skilllevel_advanced_to_expert.sh [--apply]

Modes:
  (default)  Dry-run: prints counts only, no data changes
  --apply    Executes migration ADVANCED -> EXPERT in players/doublettes/equipes
USAGE
}

MODE="dry-run"
if [[ $# -gt 1 ]]; then
  print_usage
  exit 1
fi
if [[ $# -eq 1 ]]; then
  case "$1" in
    --apply)
      MODE="apply"
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      print_usage
      exit 1
      ;;
  esac
fi

load_database_url
require_psql
detect_sql_runner

echo "[skill-level-migration] Mode: ${MODE}"
echo "[skill-level-migration] SQL runner: ${SQL_RUNNER}"

echo "[skill-level-migration] Current ADVANCED counts:"
run_sql_cmd "
SELECT 'players' AS table_name, COUNT(*) AS advanced_count FROM players WHERE skill_level = 'ADVANCED'
UNION ALL
SELECT 'doublettes', COUNT(*) FROM doublettes WHERE skill_level = 'ADVANCED'
UNION ALL
SELECT 'equipes', COUNT(*) FROM equipes WHERE skill_level = 'ADVANCED';
"

if [[ "${MODE}" != "apply" ]]; then
  echo "[skill-level-migration] Dry-run complete. Re-run with --apply to migrate." 
  exit 0
fi

run_sql_heredoc "
BEGIN;
UPDATE players SET skill_level = 'EXPERT' WHERE skill_level = 'ADVANCED';
UPDATE doublettes SET skill_level = 'EXPERT' WHERE skill_level = 'ADVANCED';
UPDATE equipes SET skill_level = 'EXPERT' WHERE skill_level = 'ADVANCED';
COMMIT;
"

echo "[skill-level-migration] Remaining ADVANCED counts after migration:"
run_sql_cmd "
SELECT 'players' AS table_name, COUNT(*) AS advanced_count FROM players WHERE skill_level = 'ADVANCED'
UNION ALL
SELECT 'doublettes', COUNT(*) FROM doublettes WHERE skill_level = 'ADVANCED'
UNION ALL
SELECT 'equipes', COUNT(*) FROM equipes WHERE skill_level = 'ADVANCED';
"

echo "[skill-level-migration] EXPERT counts after migration:"
run_sql_cmd "
SELECT 'players' AS table_name, COUNT(*) AS expert_count FROM players WHERE skill_level = 'EXPERT'
UNION ALL
SELECT 'doublettes', COUNT(*) FROM doublettes WHERE skill_level = 'EXPERT'
UNION ALL
SELECT 'equipes', COUNT(*) FROM equipes WHERE skill_level = 'EXPERT';
"

echo "[skill-level-migration] Migration completed successfully."
