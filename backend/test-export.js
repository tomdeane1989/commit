import fetch from 'node-fetch';

async function testExport() {
  try {
    // First login
    console.log('Logging in...');
    const loginRes = await fetch('http://localhost:3002/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@company.com',
        password: 'password123'
      })
    });
    
    const loginData = await loginRes.json();
    if (!loginData.token) {
      console.error('Login failed:', loginData);
      return;
    }
    const token = loginData.token;
    console.log('Login successful');
    
    // Get approved commissions to export
    console.log('Fetching approved commissions...');
    const commissionsRes = await fetch('http://localhost:3002/api/commission-approvals?status=approved', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const commissionsData = await commissionsRes.json();
    console.log('Response:', commissionsData);
    
    if (commissionsData.commissions && commissionsData.commissions.length > 0) {
      console.log(`Found ${commissionsData.commissions.length} approved commissions`);
      const commissionIds = commissionsData.commissions.map(c => c.id);
      console.log('Commission IDs:', commissionIds);
      
      // Test export with new schema
      console.log('Testing export...');
      const exportRes = await fetch('http://localhost:3002/api/commissions/export', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          commission_ids: commissionIds,
          format: 'xero_bills',
          options: {
            includeApproved: true,
            includePending: false,
            includePaid: false,
            tax_rate: 0,
            account_code: '6000'
          }
        })
      });
      
      console.log('Export response status:', exportRes.status);
      
      if (exportRes.ok) {
        const csvContent = await exportRes.text();
        console.log('\nExport successful!');
        console.log('CSV Preview (first 500 chars):');
        console.log(csvContent.substring(0, 500));
        console.log('\nExport reference:', exportRes.headers.get('X-Export-Reference'));
        console.log('Export summary:', exportRes.headers.get('X-Export-Summary'));
      } else {
        const error = await exportRes.json();
        console.error('Export failed:', error);
      }
    } else {
      console.log('No approved commissions to export');
    }
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error(error.stack);
  }
}

testExport();