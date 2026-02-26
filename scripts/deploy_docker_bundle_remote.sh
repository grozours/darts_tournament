#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

SSH_USER=""
SSH_HOST=""
SSH_PORT="22"
SSH_KEY=""
REMOTE_PROJECT_PATH=""
IMAGE_TAG="$(date +%Y%m%d-%H%M%S)"
LOCAL_BUNDLE_PATH=""
REMOTE_BUNDLE_PATH=""
SKIP_EXPORT=false
NO_UP=false
CLEAN_REMOTE_TMP=true
PRUNE_OLD_IMAGES=true
KEEP_IMAGE_COUNT=5
PUSH_MODE=false
REGISTRY_PREFIX=""

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
Usage:
  scripts/deploy_docker_bundle_remote.sh \
    --host <server> \
    --user <ssh-user> \
    --remote-path </path/to/darts_tournament> \
    [--tag <image-tag>] \
    [--port <ssh-port>] \
    [--key </path/to/key>] \
    [--bundle </path/to/local-bundle.tar.gz>] \
    [--remote-bundle </tmp/file.tar.gz>] \
    [--push] \
    [--registry <registry/namespace>] \
    [--skip-export] \
    [--no-up] \
    [--prune-old-images] \
    [--no-prune-old-images] \
    [--keep-images <count>] \
    [--keep-remote-bundle]

Flow:
  Bundle mode (default):
    1) export local docker bundle (unless --skip-export)
    2) scp bundle + compose files + import script to remote
    3) ssh remote to run scripts/import_docker_bundle.sh

  Push mode (--push):
    1) tag+push EXISTING local images to registry (no rebuild)
    2) ssh remote: pull images, retag as darts-tournament/*:$TAG
    3) run scripts/import_docker_bundle.sh --use-existing-images

Examples:
  scripts/deploy_docker_bundle_remote.sh \
    --host prod.example.com \
    --user deploy \
    --remote-path /srv/darts_tournament

  scripts/deploy_docker_bundle_remote.sh \
    --host 10.0.0.20 \
    --user ubuntu \
    --remote-path /opt/darts_tournament \
    --key ~/.ssh/prod_key \
    --tag v1.4.2

  scripts/deploy_docker_bundle_remote.sh \
    --host 10.0.0.20 \
    --user ubuntu \
    --remote-path /opt/darts_tournament \
    --keep-remote-bundle
    --prune-old-images \
    --keep-images 4

  scripts/deploy_docker_bundle_remote.sh \
    --host 10.0.0.20 \
    --user ubuntu \
    --remote-path /opt/darts_tournament \
    --no-prune-old-images

  scripts/deploy_docker_bundle_remote.sh \
    --host prod.example.com \
    --user deploy \
    --remote-path /srv/darts_tournament \
    --tag v1.9.0 \
    --push \
    --registry ghcr.io/my-org
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      SSH_HOST="$2"
      shift 2
      ;;
    --user)
      SSH_USER="$2"
      shift 2
      ;;
    --port)
      SSH_PORT="$2"
      shift 2
      ;;
    --key)
      SSH_KEY="$2"
      shift 2
      ;;
    --remote-path)
      REMOTE_PROJECT_PATH="$2"
      shift 2
      ;;
    --tag)
      IMAGE_TAG="$2"
      shift 2
      ;;
    --bundle)
      LOCAL_BUNDLE_PATH="$2"
      shift 2
      ;;
    --remote-bundle)
      REMOTE_BUNDLE_PATH="$2"
      shift 2
      ;;
    --push)
      PUSH_MODE=true
      shift
      ;;
    --registry)
      REGISTRY_PREFIX="$2"
      shift 2
      ;;
    --skip-export)
      SKIP_EXPORT=true
      shift
      ;;
    --no-up)
      NO_UP=true
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
    --keep-remote-bundle)
      CLEAN_REMOTE_TMP=false
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

if [[ -z "$SSH_HOST" || -z "$SSH_USER" || -z "$REMOTE_PROJECT_PATH" ]]; then
  print_error "--host, --user and --remote-path are required"
  usage
  exit 1
fi

if [[ "$PUSH_MODE" == "true" && -z "$REGISTRY_PREFIX" ]]; then
  print_error "--registry is required when --push is used"
  usage
  exit 1
fi

if [[ -z "$LOCAL_BUNDLE_PATH" ]]; then
  LOCAL_BUNDLE_PATH="$PROJECT_ROOT/dist/docker-bundles/darts-images-${IMAGE_TAG}.tar.gz"
fi

if [[ -z "$REMOTE_BUNDLE_PATH" ]]; then
  REMOTE_BUNDLE_PATH="/tmp/darts-images-${IMAGE_TAG}.tar.gz"
fi

LOCAL_BACKEND_IMAGE="darts-tournament/backend:${IMAGE_TAG}"
LOCAL_FRONTEND_IMAGE="darts-tournament/frontend:${IMAGE_TAG}"
REMOTE_BACKEND_IMAGE=""
REMOTE_FRONTEND_IMAGE=""

if [[ "$PUSH_MODE" == "false" ]]; then
  if [[ "$SKIP_EXPORT" == "false" ]]; then
    print_info "Exporting local bundle with tag $IMAGE_TAG"
    "$PROJECT_ROOT/scripts/export_docker_bundle.sh" --tag "$IMAGE_TAG" --output "$LOCAL_BUNDLE_PATH"
  else
    print_info "Skipping export (--skip-export)"
  fi

  if [[ ! -f "$LOCAL_BUNDLE_PATH" ]]; then
    print_error "Bundle not found: $LOCAL_BUNDLE_PATH"
    exit 1
  fi
else
  REMOTE_BACKEND_IMAGE="${REGISTRY_PREFIX%/}/darts-tournament/backend:${IMAGE_TAG}"
  REMOTE_FRONTEND_IMAGE="${REGISTRY_PREFIX%/}/darts-tournament/frontend:${IMAGE_TAG}"

  print_info "Using push mode (no build, no bundle export)"
  docker image inspect "$LOCAL_BACKEND_IMAGE" >/dev/null
  docker image inspect "$LOCAL_FRONTEND_IMAGE" >/dev/null

  print_info "Tagging local images for registry"
  docker tag "$LOCAL_BACKEND_IMAGE" "$REMOTE_BACKEND_IMAGE"
  docker tag "$LOCAL_FRONTEND_IMAGE" "$REMOTE_FRONTEND_IMAGE"

  print_info "Pushing images to registry"
  docker push "$REMOTE_BACKEND_IMAGE"
  docker push "$REMOTE_FRONTEND_IMAGE"
fi

SSH_OPTIONS=(-p "$SSH_PORT" -o StrictHostKeyChecking=accept-new)
SCP_OPTIONS=(-P "$SSH_PORT" -o StrictHostKeyChecking=accept-new)
if [[ -n "$SSH_KEY" ]]; then
  SSH_OPTIONS+=(-i "$SSH_KEY")
  SCP_OPTIONS+=(-i "$SSH_KEY")
fi

REMOTE="$SSH_USER@$SSH_HOST"
REMOTE_PROJECT_PATH_RESOLVED="$REMOTE_PROJECT_PATH"

print_info "Checking remote project directory"
ssh "${SSH_OPTIONS[@]}" "$REMOTE" "mkdir -p '$REMOTE_PROJECT_PATH_RESOLVED' '$REMOTE_PROJECT_PATH_RESOLVED/scripts'"

if [[ "$PUSH_MODE" == "false" ]]; then
  print_info "Uploading bundle to $REMOTE:$REMOTE_BUNDLE_PATH"
  scp "${SCP_OPTIONS[@]}" "$LOCAL_BUNDLE_PATH" "$REMOTE:$REMOTE_BUNDLE_PATH"
fi

print_info "Uploading compose files and import script"
scp "${SCP_OPTIONS[@]}" \
  "$PROJECT_ROOT/docker-compose.yml" \
  "$PROJECT_ROOT/docker-compose.images.yml" \
  "$REMOTE:$REMOTE_PROJECT_PATH_RESOLVED/"

scp "${SCP_OPTIONS[@]}" \
  "$PROJECT_ROOT/scripts/import_docker_bundle.sh" \
  "$REMOTE:$REMOTE_PROJECT_PATH_RESOLVED/scripts/"

REMOTE_NO_UP_FLAG=""
if [[ "$NO_UP" == "true" ]]; then
  REMOTE_NO_UP_FLAG="--no-up"
fi

REMOTE_PRUNE_FLAG=""
if [[ "$PRUNE_OLD_IMAGES" == "true" ]]; then
  REMOTE_PRUNE_FLAG="--prune-old-images --keep-images '$KEEP_IMAGE_COUNT'"
fi

print_info "Running remote import + docker relaunch"
if [[ "$PUSH_MODE" == "false" ]]; then
  ssh "${SSH_OPTIONS[@]}" "$REMOTE" "\
    set -euo pipefail; \
    cd '$REMOTE_PROJECT_PATH_RESOLVED'; \
    chmod +x ./scripts/import_docker_bundle.sh; \
    ./scripts/import_docker_bundle.sh --bundle '$REMOTE_BUNDLE_PATH' --tag '$IMAGE_TAG' $REMOTE_NO_UP_FLAG $REMOTE_PRUNE_FLAG \
  "
else
  ssh "${SSH_OPTIONS[@]}" "$REMOTE" "\
    set -euo pipefail; \
    cd '$REMOTE_PROJECT_PATH_RESOLVED'; \
    docker pull '$REMOTE_BACKEND_IMAGE'; \
    docker pull '$REMOTE_FRONTEND_IMAGE'; \
    docker tag '$REMOTE_BACKEND_IMAGE' 'darts-tournament/backend:$IMAGE_TAG'; \
    docker tag '$REMOTE_FRONTEND_IMAGE' 'darts-tournament/frontend:$IMAGE_TAG'; \
    chmod +x ./scripts/import_docker_bundle.sh; \
    ./scripts/import_docker_bundle.sh --use-existing-images --tag '$IMAGE_TAG' $REMOTE_NO_UP_FLAG $REMOTE_PRUNE_FLAG \
  "
fi

if [[ "$PUSH_MODE" == "false" && "$CLEAN_REMOTE_TMP" == "true" ]]; then
  print_info "Cleaning remote temporary bundle: $REMOTE_BUNDLE_PATH"
  ssh "${SSH_OPTIONS[@]}" "$REMOTE" "rm -f '$REMOTE_BUNDLE_PATH'"
  print_success "Remote /tmp bundle cleaned"
fi

print_success "Deployment completed"
print_info "Remote host: $SSH_HOST"
print_info "Image tag: $IMAGE_TAG"
if [[ "$PUSH_MODE" == "true" ]]; then
  print_info "Mode: push (registry)"
  print_info "Registry backend image: $REMOTE_BACKEND_IMAGE"
  print_info "Registry frontend image: $REMOTE_FRONTEND_IMAGE"
elif [[ "$CLEAN_REMOTE_TMP" == "true" ]]; then
  print_info "Remote bundle removed from /tmp"
else
  print_info "Bundle left on remote at: $REMOTE_BUNDLE_PATH"
fi
