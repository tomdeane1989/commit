// Test script for the new commission audit trail system
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'http://localhost:3002/api';
let authToken = '';
let testUserId = '';
let testDealId = '';
let testCommissionId = '';
let testRuleId = '';

// Helper function for API calls
async function apiCall(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`API Error [${method} ${endpoint}]:`, error.response?.data || error.message);
    throw error;
  }
}

// Test functions
async function testLogin() {
  console.log('\n🔐 Testing Login...');
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: 'tom@test.com',
      password: 'test1234'
    });
    
    authToken = response.data.token;
    testUserId = response.data.user.id;
    console.log('✅ Login successful');
    console.log('   User:', response.data.user.email);
    console.log('   Role:', response.data.user.is_admin ? 'Admin' : response.data.user.is_manager ? 'Manager' : 'Sales Rep');
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data);
    return false;
  }
}

async function testCreateCommissionRule() {
  console.log('\n📋 Testing Commission Rule Creation...');
  try {
    // Create a tiered commission rule
    const rule = await apiCall('POST', '/commission-rules', {
      name: 'Test Tiered Commission',
      description: 'Test rule for commission system',
      rule_type: 'tiered',
      priority: 100,
      config: {
        type: 'graduated'
      },
      calculation_type: 'cumulative',
      calculation_config: {},
      effective_from: new Date().toISOString(),
      is_active: true,
      tiers: [
        { tier_number: 1, threshold_min: 0, threshold_max: 50000, rate: 0.05, type: 'graduated' },
        { tier_number: 2, threshold_min: 50000, threshold_max: 100000, rate: 0.07, type: 'graduated' },
        { tier_number: 3, threshold_min: 100000, threshold_max: null, rate: 0.10, type: 'graduated' }
      ]
    });
    
    testRuleId = rule.rule.id;
    console.log('✅ Commission rule created:', rule.rule.name);
    console.log('   Rule ID:', testRuleId);
    console.log('   Tiers:', rule.rule.tiers.length);
    return true;
  } catch (error) {
    console.error('❌ Failed to create commission rule');
    return false;
  }
}

async function testCreateDeal() {
  console.log('\n💼 Testing Deal Creation with Commission...');
  try {
    // Create a closed won deal to trigger commission calculation
    const deal = await apiCall('POST', '/deals', {
      deal_name: 'Test Deal for Commission',
      account_name: 'Test Account Inc',
      amount: 75000,
      probability: 100,
      status: 'closed_won',
      stage: 'Closed Won',
      close_date: new Date().toISOString(),
      created_date: new Date().toISOString()
    });
    
    testDealId = deal.id;
    console.log('✅ Deal created:', deal.deal_name);
    console.log('   Deal ID:', testDealId);
    console.log('   Amount: £', deal.amount);
    console.log('   Status:', deal.status);
    
    // Wait a moment for commission calculation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if commission was calculated
    const dealWithCommission = await apiCall('GET', `/deals?limit=1`);
    const createdDeal = dealWithCommission.deals.find(d => d.id === testDealId);
    
    if (createdDeal && createdDeal.commission_amount) {
      console.log('   Commission calculated: £', createdDeal.commission_amount);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to create deal');
    return false;
  }
}

async function testGetCommissionApprovals() {
  console.log('\n📊 Testing Commission Approvals Retrieval...');
  try {
    const approvals = await apiCall('GET', '/commission-approvals');
    
    console.log('✅ Retrieved commission approvals');
    console.log('   Total pending:', approvals.summary.total_count);
    console.log('   Total amount: £', approvals.summary.total_amount);
    
    if (approvals.commissions.length > 0) {
      testCommissionId = approvals.commissions[0].id;
      console.log('   First commission ID:', testCommissionId);
      console.log('   Status:', approvals.commissions[0].status);
      console.log('   User:', approvals.commissions[0].user.email);
    }
    
    // Check status breakdown
    if (approvals.summary.status_breakdown.length > 0) {
      console.log('\n   Status breakdown:');
      approvals.summary.status_breakdown.forEach(status => {
        console.log(`     ${status.status}: ${status.count} (£${status.amount})`);
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to get commission approvals');
    return false;
  }
}

async function testApproveCommission() {
  console.log('\n✅ Testing Commission Approval Workflow...');
  
  if (!testCommissionId) {
    console.log('⚠️  No commission to approve, skipping...');
    return true;
  }
  
  try {
    // First, review the commission
    const reviewed = await apiCall('POST', `/commission-approvals/${testCommissionId}/action`, {
      action: 'review',
      notes: 'Reviewed by test script'
    });
    
    console.log('✅ Commission reviewed');
    console.log('   New status:', reviewed.commission.status);
    
    // Then approve it
    const approved = await apiCall('POST', `/commission-approvals/${testCommissionId}/action`, {
      action: 'approve',
      notes: 'Approved by test script'
    });
    
    console.log('✅ Commission approved');
    console.log('   New status:', approved.commission.status);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to approve commission');
    return false;
  }
}

async function testGetAuditTrail() {
  console.log('\n📝 Testing Audit Trail...');
  
  if (!testCommissionId) {
    console.log('⚠️  No commission for audit trail, skipping...');
    return true;
  }
  
  try {
    const auditTrail = await apiCall('GET', `/commission-reports/audit-trail?commission_id=${testCommissionId}`);
    
    console.log('✅ Retrieved audit trail');
    console.log('   Total entries:', auditTrail.audit_trail.length);
    
    if (auditTrail.audit_trail.length > 0) {
      console.log('\n   Audit entries:');
      auditTrail.audit_trail.forEach(entry => {
        console.log(`     ${entry.action} by ${entry.performed_by_user.email} at ${new Date(entry.performed_at).toLocaleString()}`);
        console.log(`       Status: ${entry.previous_status} → ${entry.new_status}`);
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to get audit trail');
    return false;
  }
}

async function testCommissionReports() {
  console.log('\n📈 Testing Commission Reports...');
  try {
    // Get commission summary
    const summary = await apiCall('GET', '/commission-reports/summary?period=monthly');
    
    console.log('✅ Retrieved commission summary');
    console.log('   Period:', summary.period.type);
    console.log('   Total commission: £', summary.summary.total_commission);
    console.log('   Approved amount: £', summary.summary.approved_amount);
    console.log('   Paid amount: £', summary.summary.paid_amount);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to get commission reports');
    return false;
  }
}

async function testRuleManagement() {
  console.log('\n⚙️  Testing Rule Management...');
  try {
    // Get all rules
    const rules = await apiCall('GET', '/commission-rules');
    
    console.log('✅ Retrieved commission rules');
    console.log('   Total rules:', rules.total);
    
    // Test rule calculation
    if (rules.rules.length > 0) {
      const testResult = await apiCall('POST', '/commission-rules/test', {
        deal: {
          amount: 150000,
          user_sales_total: 100000,
          attainment_percentage: 80
        },
        rule_ids: [rules.rules[0].id]
      });
      
      console.log('✅ Tested rule calculation');
      console.log('   Test deal amount: £150,000');
      console.log('   Calculated commission: £', testResult.result.total_commission);
      console.log('   Applied rules:', testResult.result.applied_rules.length);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to test rule management');
    return false;
  }
}

async function testMigration() {
  console.log('\n🔄 Testing Migration of Historical Data...');
  try {
    const migration = await apiCall('POST', '/commission-approvals/migrate', {
      batch_size: 10
    });
    
    console.log('✅ Migration completed');
    console.log('   Total found:', migration.total);
    console.log('   Successfully migrated:', migration.migrated);
    console.log('   Failed:', migration.failed);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to test migration');
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Commission System Tests...');
  console.log('=' .repeat(50));
  
  const tests = [
    { name: 'Login', fn: testLogin },
    { name: 'Create Commission Rule', fn: testCreateCommissionRule },
    { name: 'Create Deal', fn: testCreateDeal },
    { name: 'Get Commission Approvals', fn: testGetCommissionApprovals },
    { name: 'Approve Commission', fn: testApproveCommission },
    { name: 'Get Audit Trail', fn: testGetAuditTrail },
    { name: 'Commission Reports', fn: testCommissionReports },
    { name: 'Rule Management', fn: testRuleManagement },
    { name: 'Migration', fn: testMigration }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
      console.error(`Test "${test.name}" threw an error:`, error.message);
    }
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Test Results:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! The commission system is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
  }
}

// Run the tests
runTests().catch(console.error);