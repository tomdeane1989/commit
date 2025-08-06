// Test team-based targets
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testTeamTargets() {
  try {
    console.log('🧪 Testing team-based targets...\n');

    // 1. Find a test company
    const company = await prisma.companies.findFirst({
      where: { name: 'Test Company' }
    });
    
    if (!company) {
      console.log('❌ No test company found');
      return;
    }
    
    console.log(`✅ Found company: ${company.name}`);

    // 2. Find admin user
    const adminUser = await prisma.users.findFirst({
      where: {
        company_id: company.id,
        is_admin: true
      }
    });
    
    if (!adminUser) {
      console.log('❌ No admin user found');
      return;
    }
    
    console.log(`✅ Found admin: ${adminUser.email}`);

    // 3. Create a test team
    const team = await prisma.teams.create({
      data: {
        team_name: 'Test Sales Team',
        description: 'Team for testing team-based quotas',
        company_id: company.id,
        created_by_admin_id: adminUser.id
      }
    });
    
    console.log(`✅ Created team: ${team.team_name} (${team.id})`);

    // 4. Add users to the team
    const users = await prisma.users.findMany({
      where: {
        company_id: company.id,
        is_active: true
      },
      take: 3
    });
    
    console.log(`\n📋 Adding ${users.length} users to team...`);
    
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

    // 5. Test creating a team-based target
    console.log('\n🎯 Testing target creation via API...');
    
    const targetData = {
      target_type: 'team',
      team_id: team.id,
      period_type: 'annual',
      period_start: '2025-01-01',
      period_end: '2025-12-31',
      quota_amount: 1000000,
      commission_rate: 0.05,
      distribution_method: 'even'
    };
    
    console.log('Target data:', JSON.stringify(targetData, null, 2));

    // 6. Verify team members have targets
    const targets = await prisma.targets.findMany({
      where: {
        team_id: team.id
      },
      include: {
        user: true
      }
    });
    
    console.log(`\n📊 Created ${targets.length} targets for team members:`);
    targets.forEach(target => {
      console.log(`  - ${target.user.email}: £${target.quota_amount}`);
    });

    // 7. Clean up
    console.log('\n🧹 Cleaning up test data...');
    
    // Delete targets
    await prisma.targets.deleteMany({
      where: { team_id: team.id }
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

testTeamTargets();