#!/bin/bash

# Darts Tournament Manager - Installation Script
# This script clones and sets up both frontend and backend from GitHub
# Usage: ./install.sh [directory]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/grozours/darts_tournament.git"
REPO_SSH="git@github.com:grozours/darts_tournament.git"
DEFAULT_DIR="darts_tournament"

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

# Function to check if a command exists
check_command() {
    if ! command -v "$1" &> /dev/null; then
        print_error "$1 is not installed. Please install it first."
        return 1
    fi
    print_success "$1 is installed: $(command -v $1)"
    return 0
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local missing=0
    
    # Required tools
    check_command "git" || missing=1
    check_command "node" || missing=1
    check_command "npm" || missing=1
    
    # Check Node.js version (need >= 18)
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -lt 18 ]; then
            print_error "Node.js version 18 or higher is required. Current: $(node -v)"
            missing=1
        else
            print_success "Node.js version: $(node -v)"
        fi
    fi
    
    # Optional but recommended
    if command -v docker &> /dev/null; then
        print_success "Docker is installed (optional)"
    else
        print_warning "Docker is not installed (optional, for PostgreSQL/Redis)"
    fi
    
    if command -v psql &> /dev/null; then
        print_success "PostgreSQL client is installed"
    else
        print_warning "PostgreSQL client not installed (needed for database)"
    fi
    
    if command -v redis-cli &> /dev/null; then
        print_success "Redis client is installed"
    else
        print_warning "Redis client not installed (needed for caching)"
    fi
    
    if [ $missing -eq 1 ]; then
        print_error "Some required prerequisites are missing. Please install them first."
        exit 1
    fi
    
    print_success "All required prerequisites are met!"
}

# Function to clone the repository
clone_repo() {
    local target_dir="$1"
    
    if [ -d "$target_dir" ]; then
        print_warning "Directory '$target_dir' already exists."
        read -p "Do you want to remove it and clone fresh? (y/N): " confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            rm -rf "$target_dir"
        else
            print_status "Using existing directory..."
            return 0
        fi
    fi
    
    print_status "Cloning repository..."
    
    # Try SSH first, fall back to HTTPS
    if git clone "$REPO_SSH" "$target_dir" 2>/dev/null; then
        print_success "Cloned via SSH"
    elif git clone "$REPO_URL" "$target_dir" 2>/dev/null; then
        print_success "Cloned via HTTPS"
    else
        print_error "Failed to clone repository"
        exit 1
    fi
}

USE_DOCKER=0

# Function to setup backend
setup_backend() {
    local project_dir="$1"
    local backend_dir="$project_dir/backend"
    
    print_status "Setting up backend..."
    
    if [ ! -d "$backend_dir" ]; then
        print_error "Backend directory not found: $backend_dir"
        exit 1
    fi
    
    cd "$backend_dir"
    
    # Install dependencies
    print_status "Installing backend dependencies..."
    npm install
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env" ] && [ -f ".env.example" ]; then
        print_status "Creating .env from .env.example..."
        cp .env.example .env
        print_warning "Please edit backend/.env with your database credentials"
    elif [ ! -f ".env" ]; then
        print_status "Creating default .env file..."
        if [ "$USE_DOCKER" -eq 1 ]; then
            cat > .env << 'EOF'
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_PASSWORD=
DATABASE_URL="postgresql://darts_user:${DB_PASSWORD}@postgres:5432/darts_tournament"

# Redis Configuration
REDIS_HOST="redis"
REDIS_PORT=6379

# Auth0
AUTH_ISSUER_BASE_URL="https://your-tenant.eu.auth0.com"
AUTH_AUDIENCE="https://api.yourdomain.com"

# CORS Configuration
CORS_ORIGINS="http://localhost:3001"

# File Upload Configuration
MAX_FILE_SIZE=5242880
UPLOAD_DIR="./uploads"
EOF
        else
            cat > .env << 'EOF'
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_PASSWORD=
DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@localhost:5432/darts_tournament?schema=public"

# Redis Configuration
REDIS_HOST="localhost"
REDIS_PORT=6379

# Auth0
AUTH_ISSUER_BASE_URL="https://your-tenant.eu.auth0.com"
AUTH_AUDIENCE="https://api.yourdomain.com"

# CORS Configuration
CORS_ORIGINS="http://localhost:3001"

# File Upload Configuration
MAX_FILE_SIZE=5242880
UPLOAD_DIR="./uploads"
EOF
        fi
        print_warning "Created default .env file. Please update with your settings."
    fi
    
    # Create logs directory
    mkdir -p logs
    
    # Generate Prisma client
    print_status "Generating Prisma client..."
    npx prisma generate || print_warning "Prisma generate failed - database may not be configured"
    
    # Build TypeScript
    print_status "Building backend..."
    npm run build || print_warning "Build failed - will use ts-node for development"
    
    print_success "Backend setup complete!"
}

 # Function to setup frontend
setup_frontend() {
    local project_dir="$1"
    local frontend_dir="$project_dir/frontend"
    
    print_status "Setting up frontend..."
    
    if [ ! -d "$frontend_dir" ]; then
        print_error "Frontend directory not found: $frontend_dir"
        exit 1
    fi
    
    cd "$frontend_dir"
    
    # Install dependencies
    print_status "Installing frontend dependencies..."
    npm install
    
    # Create logs directory
    mkdir -p logs
    
    # Build frontend
    print_status "Building frontend..."
    npm run build || print_warning "Build failed - will use dev mode"
    
    print_success "Frontend setup complete!"
}

 # Function to setup database with Docker
setup_docker_services() {
    local project_dir="$1"
    
    if ! command -v docker &> /dev/null; then
        print_warning "Docker not installed. Skipping Docker services setup."
        print_warning "You need to manually set up PostgreSQL and Redis."
        return 0
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_warning "Docker Compose not installed. Skipping Docker services setup."
        return 0
    fi
    
    print_status "Starting Docker services (PostgreSQL, Redis, backend, frontend)..."
    
    cd "$project_dir"
    
    if [ -f "docker-compose.yml" ]; then
        docker compose up -d --build 2>/dev/null || docker-compose up -d --build 2>/dev/null
        print_success "Docker services started!"
        
        # Wait for services to be ready
        print_status "Waiting for services to be ready..."
        sleep 5
    else
        print_warning "docker-compose.yml not found. Skipping Docker services."
    fi
}

 # Function to run database migrations
run_migrations() {
    local project_dir="$1"
    local backend_dir="$project_dir/backend"
    
    print_status "Running database migrations..."
    
    if [ "$USE_DOCKER" -eq 1 ]; then
        cd "$project_dir"
        docker compose exec -T backend npx prisma migrate deploy 2>/dev/null || {
            print_warning "Database migrations failed in Docker. Check container logs."
            return 1
        }
    else
        cd "$backend_dir"
        npx prisma migrate deploy 2>/dev/null || npx prisma db push 2>/dev/null || {
            print_warning "Database migrations failed. Make sure PostgreSQL is running and configured."
            return 1
        }
    fi
    
    print_success "Database migrations complete!"
}

 # Function to seed the database with sample data
seed_database() {
    local project_dir="$1"
    local backend_dir="$project_dir/backend"
    
    print_status "Seeding database with sample data..."
    
    if [ "$USE_DOCKER" -eq 1 ]; then
        cd "$project_dir"
        docker compose exec -T backend npx prisma db seed 2>/dev/null || {
            print_warning "Database seeding failed in Docker. You can run it manually later: docker compose exec -T backend npx prisma db seed"
            return 1
        }
    else
        cd "$backend_dir"
        npx prisma db seed 2>/dev/null || npm run db:seed 2>/dev/null || {
            print_warning "Database seeding failed. You can run it manually later: npm run db:seed"
            return 1
        }
    fi
    
    print_success "Database seeded with sample data!"
}

# Function to export current database to SQL dump
export_database() {
    local project_dir="$1"
    local backend_dir="$project_dir/backend"
    local dump_file="$backend_dir/prisma/data-dump.sql"
    
    print_status "Exporting current database..."
    
    cd "$backend_dir"
    
    # Source .env to get DATABASE_URL
    if [ -f ".env" ]; then
        source .env
    fi
    
    # Extract connection details from DATABASE_URL
    if [ -n "$DATABASE_URL" ]; then
        # Try pg_dump if available
        if command -v pg_dump &> /dev/null; then
            pg_dump "$DATABASE_URL" --data-only --inserts > "$dump_file" 2>/dev/null && {
                print_success "Database exported to: $dump_file"
                return 0
            }
        fi
        
        # Fallback: use Prisma to export as JSON
        print_status "pg_dump not available, exporting as JSON..."
        npx ts-node -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function exportData() {
  const tournaments = await p.tournament.findMany();
  const players = await p.player.findMany();
  console.log(JSON.stringify({ tournaments, players }, null, 2));
}
exportData().finally(() => p.\$disconnect());
" > "$backend_dir/prisma/data-export.json" 2>/dev/null && {
            print_success "Database exported to: $backend_dir/prisma/data-export.json"
            return 0
        }
    fi
    
    print_warning "Could not export database. DATABASE_URL not set or export failed."
    return 1
}

# Function to import database from SQL dump or JSON
import_database() {
    local project_dir="$1"
    local backend_dir="$project_dir/backend"
    local dump_file="$backend_dir/prisma/data-dump.sql"
    local json_file="$backend_dir/prisma/data-export.json"
    
    cd "$backend_dir"
    
    # Source .env to get DATABASE_URL
    if [ -f ".env" ]; then
        source .env
    fi
    
    # Try SQL dump first
    if [ -f "$dump_file" ]; then
        print_status "Importing database from SQL dump..."
        if command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
            psql "$DATABASE_URL" < "$dump_file" 2>/dev/null && {
                print_success "Database imported from SQL dump!"
                return 0
            }
        fi
    fi
    
    # Try JSON import
    if [ -f "$json_file" ]; then
        print_status "Importing database from JSON export..."
        npx ts-node -e "
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
const p = new PrismaClient();
async function importData() {
  const data = JSON.parse(fs.readFileSync('$json_file', 'utf-8'));
  for (const t of data.tournaments || []) {
    await p.tournament.upsert({ where: { id: t.id }, update: t, create: t });
  }
  for (const pl of data.players || []) {
    await p.player.upsert({ where: { id: pl.id }, update: pl, create: pl });
  }
  console.log('Imported', data.tournaments?.length || 0, 'tournaments and', data.players?.length || 0, 'players');
}
importData().finally(() => p.\$disconnect());
" 2>/dev/null && {
            print_success "Database imported from JSON!"
            return 0
        }
    fi
    
    print_warning "No data dump found. Run 'npm run db:seed' to create sample data."
    return 1
}

# Function to display final instructions
show_final_instructions() {
    local project_dir="$1"
    
    echo ""
    echo "=========================================="
    print_success "🎯 Darts Tournament Manager installed!"
    echo "=========================================="
    echo ""
    echo "Project directory: $project_dir"
    echo ""
    echo "📋 Next steps:"
    echo ""
    echo "1. Configure the backend:"
    echo "   cd $project_dir/backend"
    echo "   Edit .env with your database credentials"
    echo ""
    echo "2. Start services with Docker Compose:"
    echo "   cd $project_dir"
    echo "   ./restart.sh both"
    echo ""
    echo "3. Run database migrations:"
    echo "   docker compose exec -T backend npx prisma migrate deploy"
    echo ""
    echo "4. Seed the database (optional):"
    echo "   docker compose exec -T backend npx prisma db seed"
    echo ""
    echo "5. Start the services:"
    echo "   cd $project_dir"
    echo "   ./restart.sh both"
    echo ""
    echo "6. Access the application:"
    echo "   Frontend: http://localhost:3001"
    echo "   Backend:  http://localhost:3000"
    echo "   Health:   http://localhost:3000/health"
    echo ""
    echo "📝 Useful commands:"
    echo "   ./restart.sh both         - Start both services"
    echo "   ./restart.sh stop         - Stop all services"
    echo "   ./restart.sh status       - Check service status"
    echo "   ./restart.sh logs backend - View backend logs"
    echo ""
    echo "🗃️ Database commands:"
    echo "   npm run db:migrate  - Apply migrations"
    echo "   npm run db:seed     - Seed sample data"
    echo "   npm run db:reset    - Reset database (WARNING: deletes all data)"
    echo "   npm run db:studio   - Open Prisma Studio (database UI)"
    echo ""
}

# Main installation function
main() {
    echo ""
    echo "🎯 Darts Tournament Manager - Installation Script"
    echo "=================================================="
    echo ""
    
    # Get target directory
    local target_dir="${1:-$DEFAULT_DIR}"
    local full_path="$(pwd)/$target_dir"
    
    if [[ "$target_dir" == /* ]]; then
        full_path="$target_dir"
    fi
    
    print_status "Installation directory: $full_path"
    echo ""
    
    # Check prerequisites
    check_prerequisites
    echo ""
    
    # Clone repository
    clone_repo "$full_path"
    echo ""
    
    # Setup Docker services (optional)
    read -p "Do you want to start Docker services (PostgreSQL, Redis, backend, frontend)? (y/N): " start_docker
    if [[ "$start_docker" =~ ^[Yy]$ ]]; then
        USE_DOCKER=1
        setup_docker_services "$full_path"
        echo ""
    fi
    
    # Setup backend
    setup_backend "$full_path"
    echo ""
    
    # Setup frontend
    setup_frontend "$full_path"
    echo ""
    
    # Run migrations
    read -p "Do you want to run database migrations now? (y/N): " run_migrations_prompt
    if [[ "$run_migrations_prompt" =~ ^[Yy]$ ]]; then
        run_migrations "$full_path"
        echo ""
        
        # Seed database
        read -p "Do you want to seed the database with sample data? (y/N): " seed_db_prompt
        if [[ "$seed_db_prompt" =~ ^[Yy]$ ]]; then
            seed_database "$full_path"
            echo ""
        fi
    fi
    
    # Show final instructions
    show_final_instructions "$full_path"
}

# Show help
show_help() {
    echo "🎯 Darts Tournament Manager - Installation Script"
    echo ""
    echo "Usage: $0 [OPTIONS] [DIRECTORY]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -y, --yes      Auto-confirm all prompts"
    echo ""
    echo "Arguments:"
    echo "  DIRECTORY      Installation directory (default: darts_tournament)"
    echo ""
    echo "Examples:"
    echo "  $0                    # Install in ./darts_tournament"
    echo "  $0 my_project         # Install in ./my_project"
    echo "  $0 /opt/darts         # Install in /opt/darts"
    echo ""
    echo "Prerequisites:"
    echo "  - Git"
    echo "  - Node.js >= 18"
    echo "  - npm"
    echo "  - PostgreSQL (or Docker)"
    echo "  - Redis (or Docker)"
    echo ""
}

# Parse arguments
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac