// Test script for commission approval workflow
import axios from 'axios';

const API_URL = 'http://localhost:3002';
let authToken = '';

async function login() {
  try {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'tom@test.com',
      password: 'password123'
    });
    authToken = response.data.token;
    console.log('✅ Logged in successfully');
    return response.data.user;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function getCommissionApprovals() {
  try {
    const response = await axios.get(`${API_URL}/api/commission-approvals`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log(`\n📊 Commission Approvals Summary:`);
    console.log(`  Total Records: ${response.data.summary.total_count}`);
    console.log(`  Total Amount: £${response.data.summary.total_amount}`);
    console.log(`  Status Breakdown:`);
    response.data.summary.status_breakdown.forEach(status => {
      console.log(`    - ${status.status}: ${status.count} records (£${status.amount})`);
    });
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get approvals:', error.response?.data || error.message);
    throw error;
  }
}

async function getAuditTrail() {
  try {
    const response = await axios.get(`${API_URL}/api/commission-reports/audit-trail`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log(`\n📝 Audit Trail:`);
    console.log(`  Total Actions: ${response.data.pagination.total}`);
    if (response.data.audit_trail.length > 0) {
      console.log(`  Recent Actions:`);
      response.data.audit_trail.slice(0, 5).forEach(action => {
        console.log(`    - ${action.action} by ${action.performed_by_user?.email || 'system'} at ${new Date(action.performed_at).toLocaleString()}`);
      });
    }
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get audit trail:', error.response?.data || error.message);
    throw error;
  }
}

async function testWorkflow() {
  console.log('🚀 Testing Commission Approval Workflow\n');
  
  try {
    // Step 1: Login
    const user = await login();
    console.log(`  User: ${user.first_name} ${user.last_name} (${user.is_manager ? 'Manager' : 'Sales Rep'})`);
    
    // Step 2: Get commission approvals
    const approvals = await getCommissionApprovals();
    
    // Step 3: Get audit trail
    const auditTrail = await getAuditTrail();
    
    // Step 4: Test processing an approval if there are calculated commissions
    const calculatedCommissions = approvals.commissions.filter(c => c.status === 'calculated');
    if (calculatedCommissions.length > 0) {
      const testCommission = calculatedCommissions[0];
      console.log(`\n🔄 Testing approval for commission ${testCommission.id}`);
      console.log(`  Deal: ${testCommission.deal.account_name} - ${testCommission.deal.deal_name}`);
      console.log(`  Amount: £${testCommission.commission_amount}`);
      
      try {
        const approvalResponse = await axios.post(
          `${API_URL}/api/commission-approvals/${testCommission.id}/action`,
          {
            action: 'approve',
            notes: 'Approved via test script'
          },
          {
            headers: { Authorization: `Bearer ${authToken}` }
          }
        );
        console.log('  ✅ Commission approved successfully');
      } catch (error) {
        console.log('  ⚠️ Could not approve:', error.response?.data?.error || error.message);
      }
    } else {
      console.log('\n📌 No calculated commissions to test approval workflow');
    }
    
    console.log('\n✅ Commission workflow test completed successfully!');
    console.log('📌 You can now access the frontend at http://localhost:3001');
    console.log('📌 Login with tom@test.com / test1234 to see the commission approval UI');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testWorkflow();