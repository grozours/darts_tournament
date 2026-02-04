#!/bin/bash

# Darts Tournament Manager - Service Restart Script (Docker Compose)
# Usage: ./restart.sh [backend|frontend|both|stop|status|logs]

PROJECT_ROOT="/home/tangi/darts_tournament"
COMPOSE_CMD="docker compose"
BACKEND_PORT=3000
FRONTEND_PORT=3001

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

# Function to start backend
start_backend() {
    print_status "Starting backend container..."
    cd "$PROJECT_ROOT" || return 1
    $COMPOSE_CMD up -d --build backend
    print_success "Backend started"
    print_status "Backend URL: http://localhost:$BACKEND_PORT"
}

# Function to start frontend
start_frontend() {
    print_status "Starting frontend container..."
    cd "$PROJECT_ROOT" || return 1
    $COMPOSE_CMD up -d --build frontend
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
    $COMPOSE_CMD down
    print_success "All containers stopped"
}

# Function to show logs
show_logs() {
    local service=$1
    case $service in
        "backend")
            if [ -f "$BACKEND_DIR/logs/server.log" ]; then
                print_status "Backend logs (last 50 lines):"
                print_status "Backend logs (last 50 lines):"
                $COMPOSE_CMD logs --tail=50 backend
            if [ -f "$FRONTEND_DIR/logs/vite.log" ]; then
                print_status "Frontend logs (last 50 lines):"
                print_status "Frontend logs (last 50 lines):"
                $COMPOSE_CMD logs --tail=50 frontend
            print_error "Invalid service. Use 'backend' or 'frontend'"
            ;;
    esac
}

# Create log directories if they don't exist
mkdir -p "$BACKEND_DIR/logs"
mkdir -p "$FRONTEND_DIR/logs"
    mkdir -p "$PROJECT_ROOT/backend/logs"
    mkdir -p "$PROJECT_ROOT/frontend/logs"
case "${1:-both}" in
    "backend")
        print_status "🔄 Restarting backend only..."
        start_backend
        ;;
    "frontend")
        print_status "🔄 Restarting frontend only..."
        start_frontend
        ;;
    "both")
        print_status "🔄 Restarting both backend and frontend..."
        start_backend && start_frontend
        ;;
            cd "$PROJECT_ROOT" || exit 1
            $COMPOSE_CMD up -d --build
            print_success "Services started"
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
        echo "Usage: $0 [COMMAND]"
        echo ""
        echo "Commands:"
        echo "  backend     Start/restart backend only"
        echo "  frontend    Start/restart frontend only"
        echo "  both        Start/restart both services (default)"
        echo "  stop        Stop all services"
        echo "  status      Check service status"
        echo "  logs        Show service logs"
        echo "    - logs backend   Show backend logs"
        echo "    - logs frontend  Show frontend logs"
        echo "  help        Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0                # Restart both services"
        echo "  $0 backend        # Restart backend only"
        echo "  $0 frontend       # Restart frontend only"
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
if [[ "$1" != "logs" && "$1" != "help" && "$1" != "-h" && "$1" != "--help" && "$1" != "stop" ]]; then
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