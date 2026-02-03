#!/bin/bash

# Darts Tournament Manager - Service Restart Script
# Usage: ./restart.sh [backend|frontend|both]

PROJECT_ROOT="/home/tangi/projets/darts_tournament/darts_tournament"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_PORT=3000
FRONTEND_PORT=5173

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

# Function to kill process on a port
kill_port() {
    local port=$1
    local service=$2
    print_status "Checking for existing $service process on port $port..."
    
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pid" ]; then
        print_warning "Killing existing $service process (PID: $pid)"
        kill -9 $pid 2>/dev/null
        sleep 2
        print_success "$service process killed"
    else
        print_status "No existing $service process found"
    fi
}

# Function to start backend
start_backend() {
    print_status "Starting backend server..."
    kill_port $BACKEND_PORT "backend"
    
    cd "$BACKEND_DIR" || {
        print_error "Cannot access backend directory: $BACKEND_DIR"
        return 1
    }
    
    # Start backend in background
    nohup npx ts-node src/server.ts > logs/server.log 2>&1 &
    local backend_pid=$!
    
    echo $backend_pid > "$PROJECT_ROOT/.backend.pid"
    print_success "Backend started (PID: $backend_pid)"
    print_status "Backend logs: $BACKEND_DIR/logs/server.log"
    print_status "Backend URL: http://localhost:$BACKEND_PORT"
    
    # Wait a moment and check if process is still running
    sleep 3
    if kill -0 $backend_pid 2>/dev/null; then
        print_success "Backend is running successfully"
    else
        print_error "Backend failed to start. Check logs: $BACKEND_DIR/logs/server.log"
        return 1
    fi
}

# Function to start frontend
start_frontend() {
    print_status "Starting frontend server..."
    kill_port $FRONTEND_PORT "frontend"
    
    cd "$FRONTEND_DIR" || {
        print_error "Cannot access frontend directory: $FRONTEND_DIR"
        return 1
    }
    
    # Start frontend in background
    nohup npm run dev > logs/vite.log 2>&1 &
    local frontend_pid=$!
    
    echo $frontend_pid > "$PROJECT_ROOT/.frontend.pid"
    print_success "Frontend started (PID: $frontend_pid)"
    print_status "Frontend logs: $FRONTEND_DIR/logs/vite.log"
    print_status "Frontend URL: http://localhost:$FRONTEND_PORT"
    
    # Wait a moment and check if process is still running
    sleep 3
    if kill -0 $frontend_pid 2>/dev/null; then
        print_success "Frontend is running successfully"
    else
        print_error "Frontend failed to start. Check logs: $FRONTEND_DIR/logs/vite.log"
        return 1
    fi
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
    
    # Stop backend
    if [ -f "$PROJECT_ROOT/.backend.pid" ]; then
        local backend_pid=$(cat "$PROJECT_ROOT/.backend.pid")
        if kill -0 $backend_pid 2>/dev/null; then
            kill -TERM $backend_pid
            print_success "Backend stopped (PID: $backend_pid)"
        fi
        rm -f "$PROJECT_ROOT/.backend.pid"
    fi
    
    # Stop frontend
    if [ -f "$PROJECT_ROOT/.frontend.pid" ]; then
        local frontend_pid=$(cat "$PROJECT_ROOT/.frontend.pid")
        if kill -0 $frontend_pid 2>/dev/null; then
            kill -TERM $frontend_pid
            print_success "Frontend stopped (PID: $frontend_pid)"
        fi
        rm -f "$PROJECT_ROOT/.frontend.pid"
    fi
    
    # Kill any remaining processes on the ports
    kill_port $BACKEND_PORT "backend"
    kill_port $FRONTEND_PORT "frontend"
}

# Function to show logs
show_logs() {
    local service=$1
    case $service in
        "backend")
            if [ -f "$BACKEND_DIR/logs/server.log" ]; then
                print_status "Backend logs (last 50 lines):"
                tail -50 "$BACKEND_DIR/logs/server.log"
            else
                print_error "Backend log file not found"
            fi
            ;;
        "frontend")
            if [ -f "$FRONTEND_DIR/logs/vite.log" ]; then
                print_status "Frontend logs (last 50 lines):"
                tail -50 "$FRONTEND_DIR/logs/vite.log"
            else
                print_error "Frontend log file not found"
            fi
            ;;
        *)
            print_error "Invalid service. Use 'backend' or 'frontend'"
            ;;
    esac
}

# Create log directories if they don't exist
mkdir -p "$BACKEND_DIR/logs"
mkdir -p "$FRONTEND_DIR/logs"

# Main script logic
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