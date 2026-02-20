#!/bin/bash

# Darts Tournament Manager - Service Restart Script (Docker Compose)
# Usage: ./restart.sh [-d] [-dev] [backend|backend+deps|frontend|both|stop|status|logs]

PROJECT_ROOT="/home/tangi/darts_tournament"
COMPOSE_CMD=()
BACKEND_PORT=3000
FRONTEND_PORT=3001
DEBUG_UI=${DEBUG_UI:-false}
DEV_PROFILE=${DEV_PROFILE:-false}
DEV_SERVICES=(postgres_test redis_test sonarqube)

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

# Function to start backend
start_backend() {
    print_status "Starting backend container..."
    cd "$PROJECT_ROOT" || return 1
    if [[ "$DEV_PROFILE" != "true" ]]; then
        stop_dev_services
    fi
    if ! "${COMPOSE_CMD[@]}" "${COMPOSE_PROFILE_ARGS[@]}" up -d --build --no-deps backend; then
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
    if [[ "$DEV_PROFILE" != "true" ]]; then
        stop_dev_services
    fi
    if ! "${COMPOSE_CMD[@]}" "${COMPOSE_PROFILE_ARGS[@]}" up -d --build backend postgres redis; then
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
    if [[ "$DEV_PROFILE" != "true" ]]; then
        stop_dev_services
    fi
    if ! "${COMPOSE_CMD[@]}" "${COMPOSE_PROFILE_ARGS[@]}" up -d --build --no-deps frontend; then
        print_error "Failed to start frontend"
        return 1
    fi
    print_success "Frontend started"
    print_status "Frontend URL: http://localhost:$FRONTEND_PORT"
}

# Function to check service status
check_status() {
    print_status "Checking service status..."
    
    # Check backend
    if curl -s http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; then
        print_success "Backend is responding on port $BACKEND_PORT"
    else
        print_error "Backend is not responding on port $BACKEND_PORT"
    fi
    
    # Check frontend
    if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
        print_success "Frontend is responding on port $FRONTEND_PORT"
    else
        print_error "Frontend is not responding on port $FRONTEND_PORT"
    fi
}

# Function to stop services
stop_services() {
    print_status "Stopping services..."
    cd "$PROJECT_ROOT" || return 1
    if ! "${COMPOSE_CMD[@]}" down; then
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
        if [[ "$DEV_PROFILE" != "true" ]]; then
            stop_dev_services
        fi
        if ! "${COMPOSE_CMD[@]}" "${COMPOSE_PROFILE_ARGS[@]}" up -d --build; then
            print_error "Failed to start services"
            exit 1
        fi
        print_success "Services started"
        check_status
        ;;
    "stop")
        stop_services
        ;;
    "status")
        check_status
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
        echo ""
        echo "Examples:"
        echo "  $0                # Restart both services"
        echo "  $0 backend        # Restart backend only"
        echo "  $0 frontend       # Restart frontend only"
        echo "  $0 -d             # Restart with debug UI enabled"
        echo "  $0 -dev           # Restart with dev profile services"
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
    echo ""
    print_status "🎯 Darts Tournament Manager is ready!"
    print_status "Backend:  http://localhost:$BACKEND_PORT"
    print_status "Frontend: http://localhost:$FRONTEND_PORT"
    echo ""
    print_status "Use '$0 logs backend' or '$0 logs frontend' to view logs"
    print_status "Use '$0 stop' to stop all services"
fi