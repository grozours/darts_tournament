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

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is not installed. Install PostgreSQL client tools first." >&2
  exit 1
fi

mkdir -p backups

if [[ $# -ge 1 ]]; then
  output_path="$1"
else
  timestamp="$(date +%Y%m%d_%H%M%S)"
  output_path="backups/darts_full_${timestamp}.dump"
fi

if [[ "${output_path}" != /* ]]; then
  output_path="${backend_root}/${output_path}"
fi

output_dir="$(dirname "${output_path}")"
mkdir -p "${output_dir}"

pg_dump "${DATABASE_URL}" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file "${output_path}"

echo "Backup created: ${output_path}"
