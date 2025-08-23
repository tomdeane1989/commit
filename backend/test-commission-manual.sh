#!/bin/bash

# Manual Commission System Test Script
# Run this after logging in via the frontend to get your auth token

echo "🚀 Commission System Manual Test"
echo "================================="
echo ""
echo "First, get your auth token from the browser:"
echo "1. Open browser DevTools (F12)"
echo "2. Go to Application/Storage > Local Storage"
echo "3. Copy the 'token' value"
echo "4. Export it: export AUTH_TOKEN='your-token-here'"
echo ""

# Check if token is set
if [ -z "$AUTH_TOKEN" ]; then
    echo "❌ AUTH_TOKEN not set. Please set it first:"
    echo "   export AUTH_TOKEN='your-token-from-browser'"
    exit 1
fi

echo "✅ Using AUTH_TOKEN from environment"
echo ""

API_URL="http://localhost:3002/api"

# Test 1: Get current user
echo "📊 Test 1: Get Current User"
curl -s -H "Authorization: Bearer $AUTH_TOKEN" \
     $API_URL/auth/me | jq '.'
echo ""

# Test 2: Create a commission rule
echo "📊 Test 2: Create Commission Rule"
RULE_RESPONSE=$(curl -s -X POST \
     -H "Authorization: Bearer $AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Tiered Commission",
       "description": "Test rule for commission system",
       "rule_type": "tiered",
       "priority": 100,
       "config": {"type": "graduated"},
       "calculation_type": "cumulative",
       "calculation_config": {},
       "effective_from": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
       "is_active": true,
       "tiers": [
         {"tier_number": 1, "threshold_min": 0, "threshold_max": 50000, "rate": 0.05, "type": "graduated"},
         {"tier_number": 2, "threshold_min": 50000, "threshold_max": 100000, "rate": 0.07, "type": "graduated"},
         {"tier_number": 3, "threshold_min": 100000, "threshold_max": null, "rate": 0.10, "type": "graduated"}
       ]
     }' \
     $API_URL/commission-rules)

echo "$RULE_RESPONSE" | jq '.'
RULE_ID=$(echo "$RULE_RESPONSE" | jq -r '.rule.id // empty')
echo "Created Rule ID: $RULE_ID"
echo ""

# Test 3: Get commission rules
echo "📊 Test 3: Get Commission Rules"
curl -s -H "Authorization: Bearer $AUTH_TOKEN" \
     $API_URL/commission-rules | jq '.total'
echo ""

# Test 4: Create a test deal (closed won to trigger commission)
echo "📊 Test 4: Create Test Deal"
DEAL_RESPONSE=$(curl -s -X POST \
     -H "Authorization: Bearer $AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "deal_name": "Test Commission Deal",
       "account_name": "Test Account Inc",
       "amount": 75000,
       "probability": 100,
       "status": "closed_won",
       "stage": "Closed Won",
       "close_date": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
       "created_date": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
     }' \
     $API_URL/deals)

echo "$DEAL_RESPONSE" | jq '.'
DEAL_ID=$(echo "$DEAL_RESPONSE" | jq -r '.id // empty')
echo "Created Deal ID: $DEAL_ID"
echo ""

# Wait for commission calculation
echo "⏳ Waiting for commission calculation..."
sleep 2

# Test 5: Get commission approvals
echo "📊 Test 5: Get Commission Approvals"
APPROVALS=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" \
     $API_URL/commission-approvals)

echo "$APPROVALS" | jq '.summary'
COMMISSION_ID=$(echo "$APPROVALS" | jq -r '.commissions[0].id // empty')
echo "First Commission ID: $COMMISSION_ID"
echo ""

# Test 6: Get commission audit trail
echo "📊 Test 6: Get Audit Trail"
if [ ! -z "$COMMISSION_ID" ]; then
    curl -s -H "Authorization: Bearer $AUTH_TOKEN" \
         "$API_URL/commission-reports/audit-trail?commission_id=$COMMISSION_ID" | jq '.audit_trail | length'
    echo "audit trail entries"
else
    echo "No commission to check audit trail"
fi
echo ""

# Test 7: Get commission summary report
echo "📊 Test 7: Get Commission Summary Report"
curl -s -H "Authorization: Bearer $AUTH_TOKEN" \
     "$API_URL/commission-reports/summary?period=monthly" | jq '.summary'
echo ""

# Test 8: Test rule calculation
echo "📊 Test 8: Test Rule Calculation"
if [ ! -z "$RULE_ID" ]; then
    curl -s -X POST \
         -H "Authorization: Bearer $AUTH_TOKEN" \
         -H "Content-Type: application/json" \
         -d '{
           "deal": {
             "amount": 150000,
             "user_sales_total": 100000,
             "attainment_percentage": 80
           },
           "rule_ids": ["'$RULE_ID'"]
         }' \
         $API_URL/commission-rules/test | jq '.result.total_commission'
    echo "calculated commission for £150,000 deal"
else
    echo "No rule to test"
fi
echo ""

echo "✅ Tests Complete!"
echo ""
echo "Check the results above. You should see:"
echo "- Commission rules created"
echo "- Deal created with commission calculated"
echo "- Approvals pending review"
echo "- Audit trail entries"
echo "- Summary reports working"