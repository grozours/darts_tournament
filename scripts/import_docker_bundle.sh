#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
BUNDLE_PATH=""
IMAGE_TAG=""
START_STACK=true
PRUNE_OLD_IMAGES=true
KEEP_IMAGE_COUNT=5
USE_EXISTING_IMAGES=false
BACKEND_HOST_UPLOADS_DIR="/app/backend/uploads"
BACKEND_HOST_LOGS_DIR="/app/backend/logs"

print_info() {
  echo "[INFO] $1"
}

print_success() {
  echo "[OK]   $1"
}

print_error() {
  echo "[ERR]  $1" >&2
}

usage() {
  cat <<'USAGE'
Usage: scripts/import_docker_bundle.sh [--bundle <bundle.tar.gz>] --tag <image-tag> [--use-existing-images] [--no-up]

Loads Docker images from bundle and optionally starts backend/frontend using compose override.
This script NEVER rewrites .env files and requires existing production env files.

Examples:
  scripts/import_docker_bundle.sh --bundle /tmp/darts-images-20260226.tar.gz --tag 20260226
  scripts/import_docker_bundle.sh --bundle ./dist/docker-bundles/darts-images-v1.2.3.tar.gz --tag v1.2.3 --no-up
  scripts/import_docker_bundle.sh --tag v1.2.3 --use-existing-images
  scripts/import_docker_bundle.sh --bundle /tmp/darts-images-20260226.tar.gz --tag 20260226 --no-prune-old-images
  scripts/import_docker_bundle.sh --bundle /tmp/darts-images-20260226.tar.gz --tag 20260226 --prune-old-images --keep-images 4
USAGE
}

require_file() {
  local file_path="$1"
  if [[ ! -f "$file_path" ]]; then
    print_error "Required file missing: $file_path"
    exit 1
  fi
}

ensure_host_directory() {
  local dir_path="$1"

  if mkdir -p "$dir_path" >/dev/null 2>&1; then
    return 0
  fi

  if command -v sudo >/dev/null 2>&1; then
    if sudo -n mkdir -p "$dir_path" >/dev/null 2>&1; then
      return 0
    fi
  fi

  print_error "Unable to create host directory: $dir_path"
  print_error "Run manually (or with sudo) then retry: mkdir -p $dir_path"
  exit 1
}

prepare_backend_host_mount_dirs() {
  print_info "Ensuring backend host mount directories exist"
  ensure_host_directory "$BACKEND_HOST_UPLOADS_DIR"
  ensure_host_directory "$BACKEND_HOST_LOGS_DIR"
  print_success "Backend host directories ready: $BACKEND_HOST_UPLOADS_DIR and $BACKEND_HOST_LOGS_DIR"
}

prune_old_images() {
  local repository="$1"
  local current_image="$2"
  local keep_count="$3"

  if ! [[ "$keep_count" =~ ^[0-9]+$ ]] || [[ "$keep_count" -lt 1 ]]; then
    print_error "Invalid --keep-images value: $keep_count (expected integer >= 1)"
    exit 1
  fi

  local used_images
  used_images="$(docker ps -a --format '{{.Image}}' | sort -u || true)"

  mapfile -t all_images < <(docker image ls "$repository" --format '{{.Repository}}:{{.Tag}}' | grep -v ':<none>$' | sort -r)

  if [[ "${#all_images[@]}" -le "$keep_count" ]]; then
    print_info "No pruning needed for $repository (count=${#all_images[@]}, keep=$keep_count)."
    return 0
  fi

  local keep_set=""
  local index=0
  for image in "${all_images[@]}"; do
    if [[ "$index" -lt "$keep_count" ]]; then
      keep_set+="$image\n"
    fi
    index=$((index + 1))
  done

  local removed=0
  for image in "${all_images[@]}"; do
    if [[ "$image" == "$current_image" ]]; then
      continue
    fi

    if printf '%b' "$keep_set" | grep -Fxq "$image"; then
      continue
    fi

    if printf '%s\n' "$used_images" | grep -Fxq "$image"; then
      print_info "Keeping image in use by a container: $image"
      continue
    fi

    if docker image rm "$image" >/dev/null 2>&1; then
      print_info "Removed old image: $image"
      removed=$((removed + 1))
    else
      print_info "Skipped image (cannot remove safely): $image"
    fi
  done

  print_success "Prune finished for $repository (removed=$removed, kept_recent=$keep_count)"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bundle)
      BUNDLE_PATH="$2"
      shift 2
      ;;
    --tag)
      IMAGE_TAG="$2"
      shift 2
      ;;
    --no-up)
      START_STACK=false
      shift
      ;;
    --use-existing-images)
      USE_EXISTING_IMAGES=true
      shift
      ;;
    --prune-old-images)
      PRUNE_OLD_IMAGES=true
      shift
      ;;
    --no-prune-old-images)
      PRUNE_OLD_IMAGES=false
      shift
      ;;
    --keep-images)
      KEEP_IMAGE_COUNT="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      print_error "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$IMAGE_TAG" ]]; then
  print_error "--tag is required"
  usage
  exit 1
fi

if [[ "$USE_EXISTING_IMAGES" == "false" ]]; then
  if [[ -z "$BUNDLE_PATH" ]]; then
    print_error "--bundle is required unless --use-existing-images is set"
    usage
    exit 1
  fi

  if [[ ! -f "$BUNDLE_PATH" ]]; then
    print_error "Bundle not found: $BUNDLE_PATH"
    exit 1
  fi
fi

BACKEND_ENV="$PROJECT_ROOT/backend/.env"
FRONTEND_ENV="$PROJECT_ROOT/frontend/.env"
ROOT_ENV="$PROJECT_ROOT/.env"

require_file "$ROOT_ENV"
require_file "$BACKEND_ENV"
require_file "$FRONTEND_ENV"
require_file "$PROJECT_ROOT/docker-compose.images.yml"

if [[ "$USE_EXISTING_IMAGES" == "false" ]]; then
  print_info "Loading Docker bundle: $BUNDLE_PATH"
  if [[ "$BUNDLE_PATH" == *.gz ]]; then
    gzip -dc "$BUNDLE_PATH" | docker load
  else
    docker load -i "$BUNDLE_PATH"
  fi
else
  print_info "Using existing local images for tag: $IMAGE_TAG"
fi

BACKEND_IMAGE="darts-tournament/backend:${IMAGE_TAG}"
FRONTEND_IMAGE="darts-tournament/frontend:${IMAGE_TAG}"

docker image inspect "$BACKEND_IMAGE" >/dev/null
docker image inspect "$FRONTEND_IMAGE" >/dev/null

print_success "Images available: $BACKEND_IMAGE and $FRONTEND_IMAGE"

if [[ "$PRUNE_OLD_IMAGES" == "true" ]]; then
  print_info "Pruning old images while keeping current tag and last $KEEP_IMAGE_COUNT tags"
  prune_old_images "darts-tournament/backend" "$BACKEND_IMAGE" "$KEEP_IMAGE_COUNT"
  prune_old_images "darts-tournament/frontend" "$FRONTEND_IMAGE" "$KEEP_IMAGE_COUNT"
fi

if [[ "$START_STACK" == "false" ]]; then
  print_info "Skipping docker compose up (--no-up)."
  exit 0
fi

prepare_backend_host_mount_dirs

print_info "Starting stack with production env files preserved"
(
  cd "$PROJECT_ROOT"
  IMAGE_TAG="$IMAGE_TAG" docker compose \
    --env-file "$ROOT_ENV" \
    -f docker-compose.images.yml \
    up -d --no-build --force-recreate --remove-orphans
)

print_info "Checking backend container status"
(
  cd "$PROJECT_ROOT"
  IMAGE_TAG="$IMAGE_TAG" docker compose \
    --env-file "$ROOT_ENV" \
    -f docker-compose.images.yml \
    ps
)

BACKEND_STATE="$(
  cd "$PROJECT_ROOT"
  IMAGE_TAG="$IMAGE_TAG" docker compose \
    --env-file "$ROOT_ENV" \
    -f docker-compose.images.yml \
    ps --format json backend 2>/dev/null || true
)"

if [[ "$BACKEND_STATE" != *'"State":"running"'* ]]; then
  print_error "Backend container is not running after deploy."
  print_info "Backend logs (last 120 lines):"
  (
    cd "$PROJECT_ROOT"
    IMAGE_TAG="$IMAGE_TAG" docker compose \
      --env-file "$ROOT_ENV" \
      -f docker-compose.images.yml \
      logs --tail=120 backend || true
  )
  exit 1
fi

BACKEND_CONTAINER_ID="$(
  cd "$PROJECT_ROOT"
  IMAGE_TAG="$IMAGE_TAG" docker compose \
    --env-file "$ROOT_ENV" \
    -f docker-compose.images.yml \
    ps -q backend
)"

if [[ -z "$BACKEND_CONTAINER_ID" ]]; then
  print_error "Unable to resolve backend container ID after deploy."
  exit 1
fi

BACKEND_RUNNING_IMAGE="$(docker inspect --format '{{.Config.Image}}' "$BACKEND_CONTAINER_ID")"
if [[ "$BACKEND_RUNNING_IMAGE" != "$BACKEND_IMAGE" ]]; then
  print_error "Backend running image mismatch. Expected: $BACKEND_IMAGE / Actual: $BACKEND_RUNNING_IMAGE"
  exit 1
fi

print_info "Repairing shared path symlinks if needed"
docker exec "$BACKEND_CONTAINER_ID" sh -lc '
  set -e
  if [ -f /app/backend/shared/src/types/index.js ] && [ ! -e /app/shared/src ]; then
    mkdir -p /app/shared
    ln -s /app/backend/shared/src /app/shared/src
  fi
  if [ -f /app/shared/src/types/index.js ] && [ ! -e /app/backend/shared/src ]; then
    mkdir -p /app/backend/shared
    ln -s /app/shared/src /app/backend/shared/src
  fi
'

SHARED_PATHS_OK="$(docker exec "$BACKEND_CONTAINER_ID" sh -lc '
  if [ -f /app/shared/src/types/index.js ] || [ -f /app/backend/shared/src/types/index.js ] || [ -f /app/backend/dist/shared/src/types/index.js ]; then
    echo yes
  else
    echo no
  fi
')"

if [[ "$SHARED_PATHS_OK" != "yes" ]]; then
  print_error "No shared runtime artifact found in backend container (checked /app/shared, /app/backend/shared, /app/backend/dist/shared)."
  print_info "Backend logs (last 120 lines):"
  (
    cd "$PROJECT_ROOT"
    IMAGE_TAG="$IMAGE_TAG" docker compose \
      --env-file "$ROOT_ENV" \
      -f docker-compose.images.yml \
      logs --tail=120 backend || true
  )
  exit 1
fi

if ! docker exec "$BACKEND_CONTAINER_ID" node -e "require('/app/backend/dist/backend/src/routes/auth.js'); require('/app/backend/dist/backend/src/routes/tournaments.js')" >/dev/null 2>&1; then
  print_error "Backend runtime require check failed for compiled route modules"
  print_info "Backend logs (last 120 lines):"
  (
    cd "$PROJECT_ROOT"
    IMAGE_TAG="$IMAGE_TAG" docker compose \
      --env-file "$ROOT_ENV" \
      -f docker-compose.images.yml \
      logs --tail=120 backend || true
  )
  exit 1
fi

for required_file in \
  /app/backend/dist/backend/src/server.js \
  /app/backend/scripts/import-presets.mjs \
  /app/backend/scripts/sync-presets-seed.mjs \
  /app/backend/prisma/current-presets-export.json; do
  if ! docker exec "$BACKEND_CONTAINER_ID" test -f "$required_file"; then
    print_error "Backend runtime file missing in container: $required_file"
    print_info "Backend logs (last 120 lines):"
    (
      cd "$PROJECT_ROOT"
      IMAGE_TAG="$IMAGE_TAG" docker compose \
        --env-file "$ROOT_ENV" \
        -f docker-compose.images.yml \
        logs --tail=120 backend || true
    )
    exit 1
  fi
done

AUTH_ME_STATUS="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/auth/me || true)"
if [[ "$AUTH_ME_STATUS" == "404" ]]; then
  print_error "Backend auth route missing: GET /api/auth/me returned 404 (expected 401 or 200)."
  print_info "Backend logs (last 120 lines):"
  (
    cd "$PROJECT_ROOT"
    IMAGE_TAG="$IMAGE_TAG" docker compose \
      --env-file "$ROOT_ENV" \
      -f docker-compose.images.yml \
      logs --tail=120 backend || true
  )
  exit 1
fi

MATCH_FORMATS_STATUS="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/tournaments/match-formats || true)"
if [[ "$MATCH_FORMATS_STATUS" != "200" ]]; then
  print_error "Backend route check failed: GET /api/tournaments/match-formats returned $MATCH_FORMATS_STATUS (expected 200)."
  print_info "Backend logs (last 120 lines):"
  (
    cd "$PROJECT_ROOT"
    IMAGE_TAG="$IMAGE_TAG" docker compose \
      --env-file "$ROOT_ENV" \
      -f docker-compose.images.yml \
      logs --tail=120 backend || true
  )
  exit 1
fi

print_success "Backend image and shared runtime resolution verified"
print_success "Backend container is running"

print_success "Deployment done with IMAGE_TAG=$IMAGE_TAG"
print_info "No .env, backend/.env, or frontend/.env file has been modified by this script."
