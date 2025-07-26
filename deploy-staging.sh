#!/bin/bash

# Staging Deployment Script for Sales Commission SaaS
# This script helps deploy to staging environment safely

set -e  # Exit on any error

echo "🚀 Starting Staging Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're on staging branch
current_branch=$(git branch --show-current)
if [ "$current_branch" != "staging/dashboard-enhancements" ]; then
    print_error "Please switch to staging/dashboard-enhancements branch first"
    exit 1
fi

print_status "Current branch: $current_branch"

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    print_error "You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

print_status "No uncommitted changes found"

# Push to staging branch
echo "📤 Pushing to staging branch..."
git push origin staging/dashboard-enhancements

print_status "Staging branch pushed to GitHub"

# Instructions for manual deployment steps
echo ""
echo "🎯 MANUAL DEPLOYMENT STEPS:"
echo ""
echo "1. DATABASE SETUP:"
echo "   - Create staging database on Render"
echo "   - Update DATABASE_URL in backend/.env.staging"
echo "   - Run migration: npm run migrate"
echo ""
echo "2. BACKEND DEPLOYMENT:"
echo "   - Create new Render service from staging branch"
echo "   - Use backend/.env.staging for environment variables"
echo "   - Service name: sales-commission-backend-staging"
echo ""
echo "3. FRONTEND DEPLOYMENT:"
echo "   - Create new Vercel project from staging branch"
echo "   - Use frontend/.env.staging for environment variables"
echo "   - Update NEXT_PUBLIC_API_URL with staging backend URL"
echo ""
echo "4. VALIDATION:"
echo "   - Test login with: test@company.com / password123"
echo "   - Verify team filtering functionality"
echo "   - Test target editing"
echo "   - Check database migration success"
echo ""

print_warning "After completing these steps, run: ./validate-staging.sh"

echo ""
print_status "Staging deployment preparation complete!"