#!/bin/bash

# Darts Tournament Manager - Service Restart Script (Docker Compose)
# Usage: ./restart.sh [-d] [-dev] [--build|--rebuild] [--prune] [--prune-volumes] [backend|backend+deps|frontend|both|stop|status|logs]

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
COMPOSE_CMD=()
BACKEND_PORT=${BACKEND_PORT:-3000}
FRONTEND_PORT=${FRONTEND_PORT:-3001}
export BACKEND_PORT FRONTEND_PORT
DEBUG_UI=${DEBUG_UI:-false}
DEV_PROFILE=${DEV_PROFILE:-false}
AUTO_DOCKER_PRUNE=${AUTO_DOCKER_PRUNE:-false}
PRUNE_VOLUMES=${PRUNE_VOLUMES:-false}
BUILD_ID=${BUILD_ID:-local}
FORCE_BUILD=${FORCE_BUILD:-true}
DEV_SERVICES=(postgres_test redis_test sonarqube sonar_init)
STATUS_RETRY_COUNT=${STATUS_RETRY_COUNT:-20}
STATUS_RETRY_DELAY=${STATUS_RETRY_DELAY:-2}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detect Docker Compose command
init_compose_cmd() {
    if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
        COMPOSE_CMD=(docker compose)
        return 0
    fi

    if command -v docker-compose >/dev/null 2>&1; then
        COMPOSE_CMD=(docker-compose)
        return 0
    fi

    print_error "Docker Compose is not available. Install Docker Desktop or docker-compose."
    exit 1
}

run_docker_prune() {
    if ! command -v docker >/dev/null 2>&1; then
        print_warning "Docker CLI not found, skipping cleanup"
        return 0
    fi

    print_status "Running Docker cleanup (this reclaims containerd overlayfs snapshots)..."
    if [[ "$PRUNE_VOLUMES" == "true" ]]; then
        docker system prune -f --volumes >/dev/null
    else
        docker system prune -f >/dev/null
    fi
    docker builder prune -f >/dev/null
    print_success "Docker cleanup completed"
}

maybe_prune_docker_storage() {
    if [[ "$AUTO_DOCKER_PRUNE" == "true" ]]; then
        run_docker_prune
    fi
}

# Function to start backend
start_backend() {
    print_status "Starting backend container..."
    cd "$PROJECT_ROOT" || return 1
    maybe_prune_docker_storage
    if [[ "$DEV_PROFILE" != "true" ]]; then
        stop_dev_services
    fi
    local build_args=()
    if [[ "$FORCE_BUILD" == "true" ]]; then
        build_args=(--build)
    fi
    if ! "${COMPOSE_CMD[@]}" "${COMPOSE_PROFILE_ARGS[@]}" up -d "${build_args[@]}" --no-deps backend; then
        print_error "Failed to start backend"
        return 1
    fi
    print_success "Backend started"
    print_status "Backend URL: http://localhost:$BACKEND_PORT"
}

# Function to start backend with dependencies
start_backend_with_deps() {
    print_status "Starting backend with dependencies..."
    cd "$PROJECT_ROOT" || return 1
    maybe_prune_docker_storage
    if [[ "$DEV_PROFILE" != "true" ]]; then
        stop_dev_services
    fi
    local build_args=()
    if [[ "$FORCE_BUILD" == "true" ]]; then
        build_args=(--build)
    fi
    if ! "${COMPOSE_CMD[@]}" "${COMPOSE_PROFILE_ARGS[@]}" up -d "${build_args[@]}" backend postgres redis; then
        print_error "Failed to start backend with dependencies"
        return 1
    fi
    print_success "Backend and dependencies started"
    print_status "Backend URL: http://localhost:$BACKEND_PORT"
}

# Function to start frontend
start_frontend() {
    print_status "Starting frontend container..."
    cd "$PROJECT_ROOT" || return 1
    maybe_prune_docker_storage
    if [[ "$DEV_PROFILE" != "true" ]]; then
        stop_dev_services
    fi
    local build_args=()
    if [[ "$FORCE_BUILD" == "true" ]]; then
        build_args=(--build)
    fi
    if ! "${COMPOSE_CMD[@]}" "${COMPOSE_PROFILE_ARGS[@]}" up -d "${build_args[@]}" --no-deps frontend; then
        print_error "Failed to start frontend"
        return 1
    fi
    print_success "Frontend started"
    print_status "Frontend URL: http://localhost:$FRONTEND_PORT"
}

# Function to check service status
check_status() {
    print_status "Checking service status..."

    local backend_ok=false
    local frontend_ok=false
    local backend_url="http://localhost:$BACKEND_PORT/health"
    local frontend_url="http://localhost:$FRONTEND_PORT"

    for ((attempt=1; attempt<=STATUS_RETRY_COUNT; attempt++)); do
        if curl -sSf "$backend_url" > /dev/null 2>&1; then
            backend_ok=true
        fi

        if curl -sSf "$frontend_url" > /dev/null 2>&1; then
            frontend_ok=true
        fi

        if [[ "$backend_ok" == "true" && "$frontend_ok" == "true" ]]; then
            break
        fi

        if (( attempt < STATUS_RETRY_COUNT )); then
            local backend_state="waiting"
            local frontend_state="waiting"
            if [[ "$backend_ok" == "true" ]]; then
                backend_state="ready"
            fi
            if [[ "$frontend_ok" == "true" ]]; then
                frontend_state="ready"
            fi
            print_status "Waiting for services... (attempt $attempt/$STATUS_RETRY_COUNT, backend: $backend_state, frontend: $frontend_state)"
            sleep "$STATUS_RETRY_DELAY"
        fi
    done

    if [[ "$backend_ok" == "true" ]]; then
        print_success "Backend is responding on port $BACKEND_PORT"
    else
        print_error "Backend is not responding on port $BACKEND_PORT"
    fi

    if [[ "$frontend_ok" == "true" ]]; then
        print_success "Frontend is responding on port $FRONTEND_PORT"
    else
        print_error "Frontend is not responding on port $FRONTEND_PORT"
    fi

    if [[ "$backend_ok" == "true" && "$frontend_ok" == "true" ]]; then
        return 0
    fi

    return 1
}

# Function to stop services
stop_services() {
    print_status "Stopping services..."
    cd "$PROJECT_ROOT" || return 1
    local default_down_ok=true
    local dev_down_ok=true

    if ! "${COMPOSE_CMD[@]}" down --remove-orphans; then
        default_down_ok=false
    fi

    if ! "${COMPOSE_CMD[@]}" --profile dev down --remove-orphans; then
        dev_down_ok=false
    fi

    stop_dev_services

    if [[ "$default_down_ok" != "true" && "$dev_down_ok" != "true" ]]; then
        print_error "Failed to stop services"
        return 1
    fi
    print_success "All containers stopped"
}

# Function to stop dev-only services
stop_dev_services() {
    print_status "Stopping dev-only containers..."
    cd "$PROJECT_ROOT" || return 1
    "${COMPOSE_CMD[@]}" stop "${DEV_SERVICES[@]}" >/dev/null 2>&1 || true
    "${COMPOSE_CMD[@]}" rm -f "${DEV_SERVICES[@]}" >/dev/null 2>&1 || true
}

ensure_presets_imported() {
    local auto_import=${IMPORT_PRESETS_ON_RESTART:-true}
    if [[ "$auto_import" != "true" ]]; then
        print_status "Preset auto-import disabled (IMPORT_PRESETS_ON_RESTART=$auto_import)"
        return 0
    fi

    local backend_container_id
    backend_container_id="$("${COMPOSE_CMD[@]}" ps -q backend 2>/dev/null)"
    if [[ -z "$backend_container_id" ]]; then
        print_warning "Backend container is not running, skipping preset check"
        return 0
    fi

    print_status "Checking presets in backend database..."

    local counts_output
    if ! counts_output="$("${COMPOSE_CMD[@]}" exec -T backend node --input-type=module -e 'import { PrismaClient } from "@prisma/client"; const prisma = new PrismaClient(); try { const tournamentCount = await prisma.tournamentPreset.count(); const matchFormatCount = await prisma.matchFormatPreset.count(); process.stdout.write(String(tournamentCount) + ":" + String(matchFormatCount)); } finally { await prisma.$disconnect(); }' 2>/dev/null)"; then
        print_warning "Unable to check preset counts, skipping auto-import"
        return 0
    fi

    counts_output="$(echo -n "$counts_output" | tr -d '[:space:]')"

    if [[ ! "$counts_output" =~ ^[0-9]+:[0-9]+$ ]]; then
        print_warning "Unexpected preset count output ('$counts_output'), skipping auto-import"
        return 0
    fi

    local tournament_count=${counts_output%%:*}
    local match_format_count=${counts_output##*:}

    if (( tournament_count > 0 && match_format_count > 0 )); then
        print_success "Presets already present (tournament: $tournament_count, match formats: $match_format_count)"
        return 0
    fi

    print_status "Missing presets detected (tournament: $tournament_count, match formats: $match_format_count). Importing..."
    if "${COMPOSE_CMD[@]}" exec -T backend sh -lc 'node scripts/import-presets.mjs'; then
        print_success "Preset import completed"
    else
        print_warning "Preset import failed (services are still running)"
    fi
}

ensure_seed_content_present() {
    local auto_import=${IMPORT_PRESETS_ON_RESTART:-true}
    if [[ "$auto_import" != "true" ]]; then
        return 0
    fi

    local backend_container_id
    backend_container_id="$("${COMPOSE_CMD[@]}" ps -q backend 2>/dev/null)"
    if [[ -z "$backend_container_id" ]]; then
        return 0
    fi

    print_status "Checking seed.mts preset content in backend database..."

    local seed_check_output
    if ! seed_check_output="$("${COMPOSE_CMD[@]}" exec -T backend node --input-type=module -e 'import fs from "node:fs"; import { PrismaClient } from "@prisma/client"; const prisma = new PrismaClient(); const seedPath = "prisma/seed.mts"; const extractDataArray = (content, variableName) => { const pattern = new RegExp(`${variableName}\\s*=\\s*await\\s*prisma\\.[\\w.]+\\.createMany\\(\\{[\\s\\S]*?data:\\s*(\\[[\\s\\S]*?\\])\\s*,\\s*skipDuplicates`, "m"); const match = content.match(pattern); if (!match || !match[1]) { return []; } try { return JSON.parse(match[1]); } catch { return []; } }; try { const seedContent = fs.readFileSync(seedPath, "utf8"); const seedMatchFormats = extractDataArray(seedContent, "const matchFormatPresets").map((item) => item?.key).filter(Boolean); const seedTournamentPresets = extractDataArray(seedContent, "const tournamentPresets").map((item) => item?.name).filter(Boolean); const dbMatchFormats = await prisma.matchFormatPreset.findMany({ select: { key: true } }); const dbTournamentPresets = await prisma.tournamentPreset.findMany({ select: { name: true } }); const dbMatchFormatKeys = new Set(dbMatchFormats.map((item) => item.key)); const dbTournamentNames = new Set(dbTournamentPresets.map((item) => item.name)); const missingMatchFormats = seedMatchFormats.filter((key) => !dbMatchFormatKeys.has(key)); const missingTournamentPresets = seedTournamentPresets.filter((name) => !dbTournamentNames.has(name)); process.stdout.write(`MISSING:${missingMatchFormats.length}:${missingTournamentPresets.length}`); } catch (error) { process.stdout.write(`CHECK_ERROR:${error instanceof Error ? error.message : String(error)}`); } finally { await prisma.$disconnect(); }' 2>/dev/null)"; then
        print_warning "Unable to verify seed.mts content, skipping db:seed fallback"
        return 0
    fi

    seed_check_output="$(echo -n "$seed_check_output" | tr -d '[:space:]')"

    if [[ "$seed_check_output" =~ ^MISSING:([0-9]+):([0-9]+)$ ]]; then
        local missing_match_formats="${BASH_REMATCH[1]}"
        local missing_tournament_presets="${BASH_REMATCH[2]}"

        if (( missing_match_formats == 0 && missing_tournament_presets == 0 )); then
            print_success "seed.mts preset content already present in database"
            return 0
        fi

        print_status "seed.mts content missing (match formats: $missing_match_formats, tournament presets: $missing_tournament_presets). Running db:seed..."
        if "${COMPOSE_CMD[@]}" exec -T backend npm run db:seed; then
            print_success "db:seed completed"
        else
            print_warning "db:seed failed (services are still running)"
        fi
        return 0
    fi

    print_warning "Unexpected seed check output ('$seed_check_output'), skipping db:seed fallback"
}

# Function to show logs
show_logs() {
    local service=$1
    case $service in
        "backend")
            print_status "Backend logs (last 50 lines):"
            "${COMPOSE_CMD[@]}" logs --tail=50 backend
            ;;
        "frontend")
            print_status "Frontend logs (last 50 lines):"
            "${COMPOSE_CMD[@]}" logs --tail=50 frontend
            ;;
        *)
            print_error "Invalid service. Use 'backend' or 'frontend'"
            ;;
    esac
}

# Create log directories if they don't exist
mkdir -p "$PROJECT_ROOT/backend/logs"
mkdir -p "$PROJECT_ROOT/frontend/logs"

POSITIONAL_ARGS=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        -d|--debug)
            DEBUG_UI=true
            shift
            ;;
        -dev|--dev)
            DEV_PROFILE=true
            shift
            ;;
        --prune)
            AUTO_DOCKER_PRUNE=true
            shift
            ;;
        --prune-volumes)
            AUTO_DOCKER_PRUNE=true
            PRUNE_VOLUMES=true
            shift
            ;;
        --build|--rebuild)
            FORCE_BUILD=true
            shift
            ;;
        --no-build)
            FORCE_BUILD=false
            shift
            ;;
        *)
            POSITIONAL_ARGS+=("$1")
            shift
            ;;
    esac
done

set -- "${POSITIONAL_ARGS[@]}"
COMMAND="${1:-both}"
export DEBUG_UI
export DEV_PROFILE
if [[ "$FORCE_BUILD" == "true" && "$BUILD_ID" == "local" ]]; then
    BUILD_ID=$(date +%s)
fi
export BUILD_ID

COMPOSE_PROFILE_ARGS=()
if [[ "$DEV_PROFILE" == "true" ]]; then
    COMPOSE_PROFILE_ARGS+=(--profile dev)
fi

init_compose_cmd
case "$COMMAND" in
    "backend")
        print_status "🔄 Restarting backend only..."
        start_backend
        ;;
    "backend+deps")
        print_status "🔄 Restarting backend with dependencies..."
        start_backend_with_deps
        ;;
    "frontend")
        print_status "🔄 Restarting frontend only..."
        start_frontend
        ;;
    "both")
        print_status "🔄 Restarting both backend and frontend..."
        cd "$PROJECT_ROOT" || exit 1
        maybe_prune_docker_storage
        if [[ "$DEV_PROFILE" != "true" ]]; then
            stop_dev_services
        fi
        if [[ "$FORCE_BUILD" == "true" ]]; then
            print_status "Building backend and frontend images in parallel..."
            if ! "${COMPOSE_CMD[@]}" "${COMPOSE_PROFILE_ARGS[@]}" build --parallel backend frontend; then
                print_error "Failed to build backend/frontend images"
                exit 1
            fi
        fi
        if ! "${COMPOSE_CMD[@]}" "${COMPOSE_PROFILE_ARGS[@]}" up -d; then
            print_error "Failed to start services"
            exit 1
        fi
        print_success "Services started"
        ;;
    "stop")
        stop_services
        ;;
    "status")
        :
        ;;
    "logs")
        if [ -n "$2" ]; then
            show_logs "$2"
        else
            print_error "Please specify which service logs to show: backend or frontend"
            print_status "Usage: $0 logs [backend|frontend]"
        fi
        ;;
    "help"|"-h"|"--help")
        echo "🎯 Darts Tournament Manager - Service Restart Script"
        echo ""
        echo "Usage: $0 [-d] [-dev] [COMMAND]"
        echo ""
        echo "Commands:"
        echo "  backend     Start/restart backend only"
        echo "  backend+deps Start/restart backend with dependencies"
        echo "  frontend    Start/restart frontend only"
        echo "  both        Start/restart both services (default)"
        echo "  stop        Stop all services"
        echo "  status      Check service status"
        echo "  logs        Show service logs"
        echo "    - logs backend   Show backend logs"
        echo "    - logs frontend  Show frontend logs"
        echo "  help        Show this help message"
        echo ""
        echo "Options:"
        echo "  -d, --debug Enable debug UI in frontend build"
        echo "  -dev, --dev Enable dev profile services"
        echo "  --build, --rebuild Force image rebuild before start (default behavior)"
        echo "  --no-build Start containers without rebuilding images"
        echo "  --prune     Run Docker prune before restart (safe: keeps named volumes)"
        echo "  --prune-volumes Run Docker prune including unused volumes"
        echo ""
        echo "Examples:"
        echo "  $0                # Restart both services"
        echo "  $0 --prune both   # Restart and reclaim Docker disk space"
        echo "  $0 backend        # Restart backend only"
        echo "  $0 frontend       # Restart frontend only"
        echo "  $0 -d             # Restart with debug UI enabled"
        echo "  $0 -dev           # Restart with dev profile services"
        echo "  $0 --build both   # Force rebuild then restart"
        echo "  $0 --no-build both # Restart quickly without rebuilding"
        echo "  $0 status         # Check if services are running"
        echo "  $0 stop           # Stop all services"
        echo "  $0 logs backend   # Show backend logs"
        ;;
    *)
        print_error "Unknown command: $1"
        print_status "Use '$0 help' for usage information"
        exit 1
        ;;
esac

# Show final status if not showing logs or help
if [[ "$COMMAND" != "logs" && "$COMMAND" != "help" && "$COMMAND" != "-h" && "$COMMAND" != "--help" && "$COMMAND" != "stop" ]]; then
    echo ""
    check_status
    status_rc=$?

    if [[ "$COMMAND" == "backend" || "$COMMAND" == "backend+deps" || "$COMMAND" == "both" ]]; then
        ensure_presets_imported
        ensure_seed_content_present
    fi

    echo ""
    print_status "🎯 Darts Tournament Manager is ready!"
    print_status "Backend:  http://localhost:$BACKEND_PORT"
    print_status "Frontend: http://localhost:$FRONTEND_PORT"
    echo ""
    print_status "Use '$0 logs backend' or '$0 logs frontend' to view logs"
    print_status "Use '$0 stop' to stop all services"

    if [[ $status_rc -ne 0 ]]; then
        exit $status_rc
    fi
fi