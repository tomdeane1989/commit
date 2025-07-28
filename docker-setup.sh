#!/bin/bash
# Sales Commission SaaS - Docker Setup Script
# Automated setup for local development with Docker

set -e

echo "🐳 Sales Commission SaaS - Docker Setup"
echo "========================================"

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

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker Desktop."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

# Set Docker Compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

print_status "Using Docker Compose command: $DOCKER_COMPOSE"

# Check if environment file exists
if [[ ! -f .env ]]; then
    print_warning ".env file not found. Creating from template..."
    cp .env.docker .env
    print_success "Created .env file from template"
    print_warning "Please edit .env file with your secure passwords before proceeding"
    read -p "Press Enter to continue after editing .env file..."
fi

# Build and start services
print_status "Building Docker images..."
$DOCKER_COMPOSE build --no-cache

print_status "Starting services..."
$DOCKER_COMPOSE up -d

# Wait for database to be ready
print_status "Waiting for database to be ready..."
sleep 10

# Run database migrations
print_status "Running database migrations..."
$DOCKER_COMPOSE exec backend npx prisma migrate deploy

# Seed database if empty
print_status "Seeding database (if empty)..."
$DOCKER_COMPOSE exec backend node seed-data.js

# Show status
print_status "Checking service status..."
$DOCKER_COMPOSE ps

print_success "🎉 Setup complete!"
echo ""
echo "Services are now running:"
echo "  - Frontend: http://localhost:3000"
echo "  - Backend API: http://localhost:3002"
echo "  - Database: localhost:5432"
echo ""
echo "Login credentials:"
echo "  - Email: test@company.com"
echo "  - Password: password123"
echo ""
echo "Useful commands:"
echo "  - View logs: $DOCKER_COMPOSE logs -f"
echo "  - Stop services: $DOCKER_COMPOSE down"
echo "  - Rebuild: $DOCKER_COMPOSE build --no-cache"
echo ""