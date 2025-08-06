// Test team-based targets via API
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3002/api';

async function login(email, password) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Login failed: ${data.error}`);
  }
  
  return data.token;
}

async function createTarget(token, targetData) {
  const response = await fetch(`${API_URL}/targets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(targetData)
  });
  
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Target creation failed: ${JSON.stringify(data)}`);
  }
  
  return data;
}

async function testTeamTargetsAPI() {
  try {
    console.log('🧪 Testing team-based targets via API...\n');

    // 1. Login as admin
    console.log('🔐 Logging in as admin...');
    const token = await login('test@company.com', 'password123');
    console.log('✅ Logged in successfully');

    // 2. Find company
    const company = await prisma.companies.findFirst({
      where: { name: 'Test Company' }
    });
    
    // 3. Find admin user
    const adminUser = await prisma.users.findFirst({
      where: {
        email: 'test@company.com'
      }
    });

    // 4. Create a test team
    console.log('\n📋 Creating test team...');
    const team = await prisma.teams.create({
      data: {
        team_name: `API Test Sales Team ${Date.now()}`,
        description: 'Team for testing team-based quotas via API',
        company_id: company.id,
        created_by_admin_id: adminUser.id
      }
    });
    
    console.log(`✅ Created team: ${team.team_name} (${team.id})`);

    // 5. Add users to the team
    const users = await prisma.users.findMany({
      where: {
        company_id: company.id,
        is_active: true,
        email: { 
          notIn: ['test@company.com', 'mike@test.com'] // Exclude the admin and mike to keep only 3 users
        }
      }
    });
    
    console.log(`\n👥 Adding ${users.length} users to team...`);
    
    for (const user of users) {
      await prisma.team_members.create({
        data: {
          team_id: team.id,
          user_id: user.id,
          added_by_admin_id: adminUser.id
        }
      });
      console.log(`  ✅ Added ${user.email}`);
    }

    // 6. Create team-based target via API
    console.log('\n🎯 Creating team-based target via API...');
    
    const targetData = {
      target_type: 'team',
      team_id: team.id,
      period_type: 'annual',
      period_start: '2027-01-01',
      period_end: '2027-12-31',
      quota_amount: 1000000,
      commission_rate: 0.05,
      distribution_method: 'even'
    };
    
    const result = await createTarget(token, targetData);
    console.log(`✅ Target creation response: ${result.message}`);
    console.log(`   Created ${result.targets.length} targets`);

    // 7. Verify targets were created
    // First check for team-based targets
    const teamTargets = await prisma.targets.findMany({
      where: {
        team_id: team.id
      },
      include: {
        user: true
      }
    });
    
    // Also check for individual targets created for team members
    const memberIds = users.map(u => u.id);
    const individualTargets = await prisma.targets.findMany({
      where: {
        user_id: { in: memberIds },
        period_start: new Date('2027-01-01'),
        period_end: new Date('2027-12-31')
      },
      include: {
        user: true
      }
    });
    
    console.log(`\n📊 Verified targets in database:`);
    console.log(`  Team targets: ${teamTargets.length}`);
    console.log(`  Individual targets: ${individualTargets.length}`);
    
    if (individualTargets.length > 0) {
      console.log('\n📋 Individual targets created:');
      individualTargets.forEach(target => {
        console.log(`  - ${target.user.email}: £${target.quota_amount} (team_id: ${target.team_id || 'null'}, id: ${target.id})`);
      });
    }
    
    // Check all targets created in this period to debug
    const allTargets = await prisma.targets.findMany({
      where: {
        period_start: new Date('2027-01-01'),
        period_end: new Date('2027-12-31'),
        company_id: company.id
      },
      include: {
        user: true,
        team: true
      }
    });
    
    console.log(`\n🔍 All targets in 2027 for this company: ${allTargets.length}`);
    allTargets.forEach(target => {
      console.log(`  - User: ${target.user.email}, Team: ${target.team?.team_name || 'none'}, team_id: ${target.team_id || 'null'}`);
    });

    // 8. Clean up
    console.log('\n🧹 Cleaning up test data...');
    
    // Delete targets - both team targets and individual targets
    await prisma.targets.deleteMany({
      where: {
        OR: [
          { team_id: team.id },
          { 
            user_id: { in: memberIds },
            period_start: new Date('2025-01-01'),
            period_end: new Date('2025-12-31')
          }
        ]
      }
    });
    
    // Delete team members
    await prisma.team_members.deleteMany({
      where: { team_id: team.id }
    });
    
    // Delete team
    await prisma.teams.delete({
      where: { id: team.id }
    });
    
    console.log('✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTeamTargetsAPI();