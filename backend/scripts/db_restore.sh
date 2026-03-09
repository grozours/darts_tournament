#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
backend_root="$(cd "${script_dir}/.." && pwd)"
cd "${backend_root}"

if [[ -z "${DATABASE_URL:-}" && -f ".env" ]]; then
  DATABASE_URL="$(sed -n 's/^DATABASE_URL=//p' .env | head -n1)"
  DATABASE_URL="${DATABASE_URL%\"}"
  DATABASE_URL="${DATABASE_URL#\"}"
  export DATABASE_URL
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set. Ensure backend/.env exists or export DATABASE_URL." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed. Install PostgreSQL client tools first." >&2
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "pg_restore is not installed. Install PostgreSQL client tools first." >&2
  exit 1
fi

dump_path=""
reset_schema=true

if [[ $# -ge 1 ]]; then
  if [[ "$1" == "--no-reset" ]]; then
    reset_schema=false
  else
    dump_path="$1"
  fi
fi

if [[ $# -ge 2 && "$2" == "--no-reset" ]]; then
  reset_schema=false
fi

if [[ -z "${dump_path}" ]]; then
  latest_dump="$(find "${backend_root}/backups" -maxdepth 1 -type f -name '*.dump' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n1 | cut -d' ' -f2-)"
  if [[ -z "${latest_dump}" ]]; then
    echo "No backup dump found in ${backend_root}/backups" >&2
    echo "Usage: $0 <dump-file> [--no-reset]" >&2
    exit 1
  fi
  dump_path="${latest_dump}"
fi

if [[ "${dump_path}" != /* ]]; then
  dump_path="${backend_root}/${dump_path}"
fi

if [[ ! -f "${dump_path}" ]]; then
  echo "Dump file not found: ${dump_path}" >&2
  exit 1
fi

if [[ "${reset_schema}" == true ]]; then
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
fi

pg_restore \
  --no-owner \
  --no-privileges \
  --dbname "${DATABASE_URL}" \
  "${dump_path}"

echo "Restore completed from: ${dump_path}"
