#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
DEFAULT_TAG="$(date +%Y%m%d-%H%M%S)"
TAG="$DEFAULT_TAG"
OUTPUT_PATH=""

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
Usage: scripts/export_docker_bundle.sh [--tag <image-tag>] [--output <bundle.tar.gz>]

Builds production Docker images and exports them into a gzip archive.

Examples:
  scripts/export_docker_bundle.sh
  scripts/export_docker_bundle.sh --tag 2026-02-26
  scripts/export_docker_bundle.sh --tag v1.2.3 --output /tmp/darts-images-v1.2.3.tar.gz
USAGE
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

mkdir -p "$(dirname -- "$OUTPUT_PATH")"

BACKEND_IMAGE="darts-tournament/backend:${TAG}"
FRONTEND_IMAGE="darts-tournament/frontend:${TAG}"

print_info "Project root: $PROJECT_ROOT"
print_info "Image tag: $TAG"
print_info "Output: $OUTPUT_PATH"

print_info "Building backend image: $BACKEND_IMAGE"
docker build -f "$PROJECT_ROOT/backend/Dockerfile" -t "$BACKEND_IMAGE" "$PROJECT_ROOT"

print_info "Building frontend image: $FRONTEND_IMAGE"
docker build -f "$PROJECT_ROOT/frontend/Dockerfile" -t "$FRONTEND_IMAGE" "$PROJECT_ROOT"

print_info "Exporting images archive"
docker save "$BACKEND_IMAGE" "$FRONTEND_IMAGE" | gzip > "$OUTPUT_PATH"

print_success "Bundle exported: $OUTPUT_PATH"
print_info "Transfer this file to prod, then run scripts/import_docker_bundle.sh there."
