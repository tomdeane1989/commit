import fetch from 'node-fetch';

async function testAuthRoles() {
  try {
    console.log('Testing authenticated roles API...');
    
    // First login to get a token
    const loginResponse = await fetch('http://localhost:3002/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'tom@test.com',
        password: 'password123'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login response:', {
      success: loginData.success,
      user: loginData.user,
      tokenExists: !!loginData.token
    });
    
    if (!loginData.success) {
      console.error('Login failed:', loginData);
      return;
    }
    
    // Now test the roles API
    const rolesResponse = await fetch('http://localhost:3002/api/user-management/roles', {
      headers: { 
        'Authorization': `Bearer ${loginData.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const rolesData = await rolesResponse.json();
    console.log('Roles API response:', rolesData);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAuthRoles();