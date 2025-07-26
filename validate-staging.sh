#!/bin/bash

# Staging Validation Script
# Comprehensive testing of staging environment

set -e

echo "🧪 Starting Staging Environment Validation..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_test() {
    echo -e "${YELLOW}🔍 Testing: $1${NC}"
}

print_pass() {
    echo -e "${GREEN}✅ PASS: $1${NC}"
}

print_fail() {
    echo -e "${RED}❌ FAIL: $1${NC}"
}

# Get staging URLs from user
echo "Please provide your staging environment URLs:"
read -p "Staging Frontend URL (e.g., https://sales-commission-staging.vercel.app): " STAGING_FRONTEND
read -p "Staging Backend URL (e.g., https://sales-commission-backend-staging.render.com): " STAGING_BACKEND

echo ""
echo "🎯 STAGING VALIDATION CHECKLIST"
echo "================================="

# 1. Backend Health Check
print_test "Backend Health Check"
if curl -s -f "$STAGING_BACKEND/health" > /dev/null 2>&1; then
    print_pass "Backend is responding"
else
    print_fail "Backend is not responding"
fi

# 2. Database Connection
print_test "Database Connection"
if curl -s -f "$STAGING_BACKEND/api/dashboard/sales-rep" -H "Authorization: Bearer test-token" > /dev/null 2>&1; then
    print_pass "Database connection working"
else
    print_fail "Database connection issues"
fi

# 3. Frontend Loading
print_test "Frontend Loading"
if curl -s -f "$STAGING_FRONTEND" > /dev/null 2>&1; then
    print_pass "Frontend is loading"
else
    print_fail "Frontend is not loading"
fi

echo ""
echo "🔧 MANUAL TESTING CHECKLIST:"
echo "=============================="
echo ""
echo "□ 1. LOGIN FUNCTIONALITY"
echo "   - Visit: $STAGING_FRONTEND/login"
echo "   - Email: test@company.com"
echo "   - Password: password123"
echo "   - Verify successful login"
echo ""
echo "□ 2. DASHBOARD TEAM FILTERING"
echo "   - Visit: $STAGING_FRONTEND/dashboard"
echo "   - Test toggle buttons: Personal/Team/All"
echo "   - Select individual team members"
echo "   - Verify data changes correctly"
echo ""
echo "□ 3. TARGET EDITING"
echo "   - Visit: $STAGING_FRONTEND/team"
echo "   - Click Targets & Quotas tab"
echo "   - Edit a team aggregated target"
echo "   - Change commission rate to 2%"
echo "   - Verify save works without validation errors"
echo ""
echo "□ 4. DATABASE MIGRATION"
echo "   - Check backend logs for migration success"
echo "   - Verify deals table has unique constraint"
echo "   - Confirm no data loss occurred"
echo ""
echo "□ 5. PERFORMANCE CHECK"
echo "   - Navigate through all pages"
echo "   - Check page load times < 3 seconds"
echo "   - Verify no JavaScript errors in console"
echo ""

echo "🎯 COMPLETION CRITERIA:"
echo "======================="
echo "□ All API endpoints responding correctly"
echo "□ Authentication flow working"
echo "□ Team filtering functionality operational"
echo "□ Target editing saves successfully"
echo "□ No console errors or 500 responses"
echo "□ Database migration completed successfully"
echo ""

echo "✅ Once all items are checked, staging is ready for production deployment!"
echo ""
echo "To proceed to production: ./deploy-production.sh"