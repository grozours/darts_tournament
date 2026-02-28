#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
DEFAULT_TAG="$(date +%Y%m%d-%H%M%S)"
TAG="$DEFAULT_TAG"
OUTPUT_PATH=""
PRE_EXPORT_CLEANUP=true
PRUNE_BUILD_CACHE=true
KEEP_IMAGE_COUNT=5

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
Usage: scripts/export_docker_bundle.sh [--tag <image-tag>] [--output <bundle.tar.gz>] [--keep-images <count>] [--no-cleanup] [--no-prune-build-cache]

Builds production Docker images and exports them into a gzip archive.

Examples:
  scripts/export_docker_bundle.sh
  scripts/export_docker_bundle.sh --tag 2026-02-26
  scripts/export_docker_bundle.sh --tag v1.2.3 --output /tmp/darts-images-v1.2.3.tar.gz
  scripts/export_docker_bundle.sh --keep-images 3
  scripts/export_docker_bundle.sh --no-cleanup
  scripts/export_docker_bundle.sh --no-prune-build-cache
USAGE
}

prune_local_images() {
  local repository="$1"
  local current_image="$2"
  local keep_count="$3"

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
      removed=$((removed + 1))
    fi
  done

  print_success "Prune finished for $repository (removed=$removed, kept_recent=$keep_count)"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      TAG="$2"
      shift 2
      ;;
    --output)
      OUTPUT_PATH="$2"
      shift 2
      ;;
    --keep-images)
      KEEP_IMAGE_COUNT="$2"
      shift 2
      ;;
    --no-cleanup)
      PRE_EXPORT_CLEANUP=false
      shift
      ;;
    --prune-build-cache)
      PRUNE_BUILD_CACHE=true
      shift
      ;;
    --no-prune-build-cache)
      PRUNE_BUILD_CACHE=false
      shift
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

if [[ -z "$OUTPUT_PATH" ]]; then
  OUTPUT_PATH="$PROJECT_ROOT/dist/docker-bundles/darts-images-${TAG}.tar.gz"
fi

if ! [[ "$KEEP_IMAGE_COUNT" =~ ^[0-9]+$ ]] || [[ "$KEEP_IMAGE_COUNT" -lt 1 ]]; then
  print_error "Invalid --keep-images value: $KEEP_IMAGE_COUNT (expected integer >= 1)"
  exit 1
fi

mkdir -p "$(dirname -- "$OUTPUT_PATH")"

BACKEND_IMAGE="darts-tournament/backend:${TAG}"
FRONTEND_IMAGE="darts-tournament/frontend:${TAG}"

print_info "Project root: $PROJECT_ROOT"
print_info "Image tag: $TAG"
print_info "Output: $OUTPUT_PATH"

if [[ "$PRE_EXPORT_CLEANUP" == "true" ]]; then
  print_info "Running pre-export Docker cleanup"
  prune_local_images "darts-tournament/backend" "$BACKEND_IMAGE" "$KEEP_IMAGE_COUNT"
  prune_local_images "darts-tournament/frontend" "$FRONTEND_IMAGE" "$KEEP_IMAGE_COUNT"
  docker image prune -f >/dev/null || true

  if [[ "$PRUNE_BUILD_CACHE" == "true" ]]; then
    if docker buildx version >/dev/null 2>&1; then
      print_info "Pruning build cache (buildx)"
      docker buildx prune -af >/dev/null || true
    else
      print_info "buildx not available, skipping build cache prune"
    fi
  fi
else
  print_info "Skipping pre-export Docker cleanup (--no-cleanup)"
fi

print_info "Building backend image: $BACKEND_IMAGE"
docker build -f "$PROJECT_ROOT/backend/Dockerfile" -t "$BACKEND_IMAGE" "$PROJECT_ROOT"

print_info "Building frontend image: $FRONTEND_IMAGE"
docker build -f "$PROJECT_ROOT/frontend/Dockerfile" -t "$FRONTEND_IMAGE" "$PROJECT_ROOT"

BACKEND_IMAGE_ID="$(docker image inspect --format '{{.Id}}' "$BACKEND_IMAGE")"
FRONTEND_IMAGE_ID="$(docker image inspect --format '{{.Id}}' "$FRONTEND_IMAGE")"
print_info "Built backend image id:  $BACKEND_IMAGE_ID"
print_info "Built frontend image id: $FRONTEND_IMAGE_ID"

print_info "Exporting images archive"
docker save "$BACKEND_IMAGE" "$FRONTEND_IMAGE" | gzip > "$OUTPUT_PATH"

MANIFEST_PATH="${OUTPUT_PATH%.tar.gz}.manifest.txt"
{
  echo "tag=$TAG"
  echo "backend_image=$BACKEND_IMAGE"
  echo "backend_id=$BACKEND_IMAGE_ID"
  echo "frontend_image=$FRONTEND_IMAGE"
  echo "frontend_id=$FRONTEND_IMAGE_ID"
  echo "exported_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if command -v git >/dev/null 2>&1; then
    echo "git_commit=$(git -C \"$PROJECT_ROOT\" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  fi
} > "$MANIFEST_PATH"

print_success "Bundle exported: $OUTPUT_PATH"
print_success "Bundle manifest: $MANIFEST_PATH"
print_info "Transfer this file to prod, then run scripts/import_docker_bundle.sh there."
