#!/bin/bash

# Railway Deployment Script for Roulette System
# Automates deployment process with validation and monitoring

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_ROOT/dist"
LOG_DIR="$PROJECT_ROOT/logs"

# Functions
log() {
    echo -e "${2:-$NC}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_success() {
    log "$1" "$GREEN"
}

log_error() {
    log "$1" "$RED"
}

log_warning() {
    log "$1" "$YELLOW"
}

log_info() {
    log "$1" "$CYAN"
}

# Check if Railway CLI is installed
check_railway_cli() {
    if ! command -v railway &> /dev/null; then
        log_error "Railway CLI not found. Installing..."
        npm install -g @railway/cli
    fi
    log_success "Railway CLI found"
}

# Validate environment
validate_environment() {
    log_info "🔍 Validating deployment environment..."
    
    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js version $NODE_VERSION is too old. Requires Node.js 18+"
        exit 1
    fi
    log_success "Node.js version $NODE_VERSION OK"
    
    # Check if required files exist
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        log_error "package.json not found"
        exit 1
    fi
    
    if [ ! -f "$PROJECT_ROOT/Dockerfile" ]; then
        log_error "Dockerfile not found"
        exit 1
    fi
    
    if [ ! -f "$PROJECT_ROOT/railway.json" ]; then
        log_error "railway.json not found"
        exit 1
    fi
    
    log_success "Required files present"
}

# Run system requirements validation
run_system_validation() {
    log_info "🔍 Running system requirements validation..."
    
    if [ -f "$PROJECT_ROOT/scripts/system-requirements.js" ]; then
        if node "$PROJECT_ROOT/scripts/system-requirements.js"; then
            log_success "System requirements validation passed"
        else
            log_error "System requirements validation failed"
            exit 1
        fi
    else
        log_warning "System requirements script not found, skipping validation"
    fi
}

# Clean and prepare build
clean_build() {
    log_info "🧹 Cleaning build directory..."
    
    # Remove old build artifacts
    if [ -d "$BUILD_DIR" ]; then
        rm -rf "$BUILD_DIR"
        log_success "Removed old build directory"
    fi
    
    # Remove node_modules/.cache if exists
    if [ -d "$PROJECT_ROOT/node_modules/.cache" ]; then
        rm -rf "$PROJECT_ROOT/node_modules/.cache"
        log_success "Cleaned npm cache"
    fi
    
    # Create log directory
    mkdir -p "$LOG_DIR"
    log_success "Created log directory"
}

# Install dependencies
install_dependencies() {
    log_info "📦 Installing dependencies..."
    
    # Set npm flags for Railway deployment
    export npm_config_fund=false
    export npm_config_audit=false
    export npm_config_loglevel=error
    
    if npm ci --prefer-offline --no-audit --no-fund; then
        log_success "Dependencies installed successfully"
    else
        log_error "Failed to install dependencies"
        exit 1
    fi
}

# Build application
build_application() {
    log_info "🔨 Building application..."
    
    # Run preflight checks
    if npm run preflight 2>/dev/null; then
        log_success "Preflight checks passed"
    else
        log_warning "Preflight checks failed, continuing..."
    fi
    
    # Build TypeScript
    if npm run build; then
        log_success "Application built successfully"
    else
        log_error "Application build failed"
        exit 1
    fi
}

# Validate build output
validate_build() {
    log_info "🔍 Validating build output..."
    
    # Check if dist directory exists
    if [ ! -d "$BUILD_DIR" ]; then
        log_error "Build directory not found"
        exit 1
    fi
    
    # Check for main entry point
    if [ ! -f "$BUILD_DIR/src/index.js" ]; then
        log_error "Main entry point not found"
        exit 1
    fi
    
    # Test critical dependencies
    if node -e "
        try {
            require('canvas');
            require('sharp');
            require('@prisma/client');
            console.log('✅ Critical dependencies OK');
        } catch (e) {
            console.error('❌ Critical dependency failed:', e.message);
            process.exit(1);
        }
    "; then
        log_success "Build validation passed"
    else
        log_error "Build validation failed"
        exit 1
    fi
}

# Docker build test
test_docker_build() {
    log_info "🐳 Testing Docker build..."
    
    # Build Docker image locally
    if docker build -t roulette-system:test .; then
        log_success "Docker build successful"
        
        # Test running container
        if docker run --rm -d --name roulette-test roulette-system:test; then
            log_success "Docker container test started"
            sleep 10
            
            # Check if container is running
            if docker ps | grep -q roulette-test; then
                log_success "Docker container is running"
                docker stop roulette-test > /dev/null 2>&1
            else
                log_error "Docker container failed to start"
                docker logs roulette-test || true
                exit 1
            fi
        else
            log_error "Failed to start Docker container"
            exit 1
        fi
    else
        log_error "Docker build failed"
        exit 1
    fi
}

# Deploy to Railway
deploy_to_railway() {
    log_info "🚀 Deploying to Railway..."
    
    # Check if user is logged in to Railway
    if ! railway whoami &> /dev/null; then
        log_info "Please log in to Railway..."
        railway login
    fi
    
    # Link to project (if not already linked)
    if [ ! -f "$PROJECT_ROOT/.railway" ]; then
        log_info "Linking to Railway project..."
        railway link
    fi
    
    # Deploy
    if railway deploy; then
        log_success "Deployment successful!"
        
        # Get deployment URL
        DEPLOYMENT_URL=$(railway domain 2>/dev/null | head -1 || echo "No domain found")
        if [ ! -z "$DEPLOYMENT_URL" ]; then
            log_success "Deployment URL: $DEPLOYMENT_URL"
        fi
    else
        log_error "Deployment failed"
        exit 1
    fi
}

# Post-deployment validation
post_deployment_validation() {
    log_info "🔍 Running post-deployment validation..."
    
    # Wait for deployment to be ready
    log_info "Waiting for deployment to be ready..."
    sleep 30
    
    # Check health endpoint
    DEPLOYMENT_URL=$(railway domain 2>/dev/null | head -1 || echo "")
    if [ ! -z "$DEPLOYMENT_URL" ]; then
        if curl -f -s "https://$DEPLOYMENT_URL/health" > /dev/null; then
            log_success "Health check passed"
        else
            log_warning "Health check failed - deployment might still be starting"
        fi
    else
        log_warning "No domain found for health check"
    fi
}

# Cleanup
cleanup() {
    log_info "🧹 Cleaning up..."
    
    # Remove test Docker images
    docker rmi roulette-system:test &> /dev/null || true
    
    # Clean npm cache
    npm cache clean --force &> /dev/null || true
    
    log_success "Cleanup completed"
}

# Main deployment function
main() {
    log_info "🎯 Starting Railway Deployment Process"
    echo "========================================"
    
    # Change to project directory
    cd "$PROJECT_ROOT"
    
    # Run deployment steps
    check_railway_cli
    validate_environment
    run_system_validation
    clean_build
    install_dependencies
    build_application
    validate_build
    test_docker_build
    deploy_to_railway
    post_deployment_validation
    cleanup
    
    echo "========================================"
    log_success "🎉 Deployment completed successfully!"
    log_info "🌐 Check Railway dashboard for deployment status"
    log_info "🏥 Health check: https://your-app.railway.app/health"
    log_info "📊 Logs: railway logs"
}

# Error handling
trap 'log_error "❌ Deployment failed at line $LINENO"' ERR

# Run main function
main "$@"