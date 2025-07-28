#!/bin/bash

# Production Health Check Script
# Usage: ./scripts/verify-production-health.sh

set -e

# Configuration
BACKEND_URL="https://sales-commission-backend-latest.onrender.com"
FRONTEND_URL="https://sales-commission-saas.vercel.app"
TIMEOUT=30

echo "🏥 Starting production health checks..."

# Function to check HTTP status
check_endpoint() {
    local url=$1
    local name=$2
    local expected_status=${3:-200}
    
    echo "🔍 Checking $name: $url"
    
    # Get HTTP status code with timeout
    local status=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url")
    
    if [ "$status" -eq "$expected_status" ]; then
        echo "✅ $name: HTTP $status (OK)"
        return 0
    else
        echo "❌ $name: HTTP $status (Expected $expected_status)"
        return 1
    fi
}

# Function to check API health endpoint
check_api_health() {
    local health_url="$BACKEND_URL/health"
    
    echo "🔍 Checking API health endpoint..."
    
    # Get health response
    local response=$(curl -s --max-time $TIMEOUT "$health_url" || echo '{"status":"error"}')
    local status=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
    
    if [ "$status" = "healthy" ]; then
        echo "✅ API Health: $status"
        
        # Show additional health details if available
        local users=$(echo "$response" | grep -o '"users":[0-9]*' | cut -d':' -f2 || echo "?")
        local targets=$(echo "$response" | grep -o '"targets":[0-9]*' | cut -d':' -f2 || echo "?")
        echo "   📊 Users: $users, Targets: $targets"
        
        return 0
    else
        echo "❌ API Health: $status"
        echo "   Response: $response"
        return 1
    fi
}

# Function to test authentication
check_auth() {
    local auth_url="$BACKEND_URL/auth/login"
    
    echo "🔍 Testing authentication endpoint..."
    
    # Test login endpoint (should return 400 for missing credentials, not 500)
    local status=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT \
        -X POST -H "Content-Type: application/json" \
        -d '{}' "$auth_url")
    
    if [ "$status" -eq 400 ]; then
        echo "✅ Authentication: HTTP $status (Properly rejecting empty request)"
        return 0
    elif [ "$status" -eq 200 ]; then
        echo "⚠️  Authentication: HTTP $status (Unexpected success with empty request)"
        return 0
    else
        echo "❌ Authentication: HTTP $status (Server error)"
        return 1
    fi
}

# Run all health checks
FAILED_CHECKS=0

# Check backend API root
check_endpoint "$BACKEND_URL" "Backend API" 404 || ((FAILED_CHECKS++))

# Check API health endpoint
check_api_health || ((FAILED_CHECKS++))

# Check authentication
check_auth || ((FAILED_CHECKS++))

# Check frontend
echo ""
echo "🌐 Checking frontend..."
check_endpoint "$FRONTEND_URL" "Frontend App" 200 || ((FAILED_CHECKS++))

# Summary
echo ""
echo "📋 Health Check Summary:"
if [ $FAILED_CHECKS -eq 0 ]; then
    echo "✅ All checks passed - Production is healthy"
    exit 0
else
    echo "❌ $FAILED_CHECKS check(s) failed - Production may have issues"
    exit 1
fi