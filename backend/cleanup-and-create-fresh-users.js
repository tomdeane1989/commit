// cleanup-and-create-fresh-users.js - Complete the migration
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupAndCreateFresh() {
  console.log('🔄 Completing migration - cleanup and fresh user creation...');
  
  try {
    // Step 1: Delete original @test.com users and their data (they've been migrated to @test2.com)
    console.log('📋 Step 1: Finding remaining @test.com users...');
    
    const remainingTestUsers = await prisma.users.findMany({
      where: {
        email: { endsWith: '@test.com' }
      }
    });
    
    console.log(`Found ${remainingTestUsers.length} @test.com users to clean up`);
    
    if (remainingTestUsers.length > 0) {
      const userIds = remainingTestUsers.map(u => u.id);
      
      // Delete in reverse order of dependencies
      console.log('  🗑️ Deleting user data...');
      
      await prisma.deal_categorizations.deleteMany({
        where: { user_id: { in: userIds } }
      });
      
      await prisma.forecasts.deleteMany({
        where: { user_id: { in: userIds } }
      });
      
      await prisma.activity_log.deleteMany({
        where: { user_id: { in: userIds } }
      });
      
      // Delete commission details first (foreign key dependency)
      const commissionIds = await prisma.commissions.findMany({
        where: { user_id: { in: userIds } },
        select: { id: true }
      });
      
      if (commissionIds.length > 0) {
        await prisma.commission_details.deleteMany({
          where: { commission_id: { in: commissionIds.map(c => c.id) } }
        });
      }
      
      await prisma.commissions.deleteMany({
        where: { user_id: { in: userIds } }
      });
      
      // Delete all admin-created resources
      await prisma.company_roles.deleteMany({
        where: { created_by_admin_id: { in: userIds } }
      });
      
      await prisma.company_sub_roles.deleteMany({
        where: { created_by_admin_id: { in: userIds } }
      });
      
      await prisma.allocation_patterns.deleteMany({
        where: { created_by_id: { in: userIds } }
      });
      
      await prisma.team_members.deleteMany({
        where: { added_by_admin_id: { in: userIds } }
      });
      
      await prisma.teams.deleteMany({
        where: { created_by_admin_id: { in: userIds } }
      });
      
      await prisma.deals.deleteMany({
        where: { user_id: { in: userIds } }
      });
      
      await prisma.targets.deleteMany({
        where: { user_id: { in: userIds } }
      });
      
      await prisma.users.deleteMany({
        where: { id: { in: userIds } }
      });
      
      console.log(`  ✅ Deleted ${remainingTestUsers.length} users and their data`);
    }
    
    // Step 2: Find the original company
    console.log('📋 Step 2: Finding original company...');
    
    const originalCompany = await prisma.companies.findFirst({
      where: { 
        name: 'Test Company'
      }
    });
    
    if (!originalCompany) {
      throw new Error('Could not find original test company');
    }
    
    console.log(`Found original company: ${originalCompany.name}`);
    
    // Step 3: Create fresh @test.com users for main branch testing
    console.log('📋 Step 3: Creating fresh @test.com users for main branch...');
    
    const freshUsers = [
      {
        email: 'tom@test.com',
        password: '$2b$10$rw.bpVRx2oBmyGJr3HpE1OlpQo0aVZaePxpK0IG7Y1MJpf5P9QwGO', // password123
        first_name: 'Tom',
        last_name: 'Deane',
        role: 'manager',
        is_admin: true,
        territory: null
      },
      {
        email: 'sarah@test.com',
        password: '$2b$10$rw.bpVRx2oBmyGJr3HpE1OlpQo0aVZaePxpK0IG7Y1MJpf5P9QwGO', // password123
        first_name: 'Sarah',
        last_name: 'Mitchell',
        role: 'manager',
        is_admin: true,
        territory: 'UK North',
        hire_date: new Date('2024-01-15')
      },
      {
        email: 'alex@test.com',
        password: '$2b$10$rw.bpVRx2oBmyGJr3HpE1OlpQo0aVZaePxpK0IG7Y1MJpf5P9QwGO', // password123
        first_name: 'Alex',
        last_name: 'Johnson',
        role: 'sales_rep',
        is_admin: false,
        territory: 'UK South'
      },
      {
        email: 'mike@test.com',
        password: '$2b$10$rw.bpVRx2oBmyGJr3HpE1OlpQo0aVZaePxpK0IG7Y1MJpf5P9QwGO', // password123
        first_name: 'Mike',
        last_name: 'Wilson',
        role: 'sales_rep',
        is_admin: false,
        territory: 'UK Central'
      }
    ];
    
    const managerUsers = [];
    
    for (const userData of freshUsers) {
      const newUser = await prisma.users.create({
        data: {
          ...userData,
          company_id: originalCompany.id,
          manager_id: null // Will set after creating managers
        }
      });
      
      if (userData.role === 'manager') {
        managerUsers.push(newUser);
      }
      
      console.log(`  ✅ Created fresh user: ${userData.email}`);
    }
    
    // Set manager relationships
    if (managerUsers.length > 0) {
      const managerId = managerUsers[0].id; // Tom as main manager
      
      await prisma.users.updateMany({
        where: {
          email: { in: ['alex@test.com', 'mike@test.com'] },
          company_id: originalCompany.id
        },
        data: { manager_id: managerId }
      });
      
      console.log('  ✅ Set manager relationships');
    }
    
    // Step 4: Create basic targets for testing
    console.log('📋 Step 4: Creating basic targets for main branch testing...');
    
    const currentYear = new Date().getFullYear();
    const users = await prisma.users.findMany({
      where: { email: { endsWith: '@test.com' } }
    });
    
    for (const user of users) {
      await prisma.targets.create({
        data: {
          period_type: 'annual',
          period_start: new Date(`${currentYear}-01-01`),
          period_end: new Date(`${currentYear}-12-31`),
          quota_amount: user.role === 'manager' ? 500000 : 100000,
          commission_rate: 0.05,
          is_active: true,
          commission_payment_schedule: 'monthly',
          team_target: false,
          user_id: user.id,
          company_id: originalCompany.id
        }
      });
      
      console.log(`  ✅ Created target for ${user.email}: ${user.role === 'manager' ? '£500K' : '£100K'}`);
    }
    
    // Step 5: Create some basic deals for testing
    console.log('📋 Step 5: Creating basic deals for testing...');
    
    const salesReps = users.filter(u => u.role === 'sales_rep');
    const sampleDeals = [
      { name: 'Acme Corp Deal', account: 'Acme Corporation', amount: 50000, probability: 75, stage: 'Proposal' },
      { name: 'TechStart Integration', account: 'TechStart Ltd', amount: 25000, probability: 60, stage: 'Negotiation' },
      { name: 'Global Solutions', account: 'Global Solutions Inc', amount: 75000, probability: 90, stage: 'Closed Won' },
      { name: 'Innovation Labs', account: 'Innovation Labs', amount: 30000, probability: 45, stage: 'Discovery' }
    ];
    
    let dealCount = 0;
    for (let i = 0; i < salesReps.length && i < sampleDeals.length; i++) {
      const user = salesReps[i];
      const dealData = sampleDeals[i];
      
      await prisma.deals.create({
        data: {
          deal_name: dealData.name,
          account_name: dealData.account,
          amount: dealData.amount,
          probability: dealData.probability,
          status: dealData.stage === 'Closed Won' ? 'closed_won' : 'open',
          stage: dealData.stage,
          close_date: new Date(currentYear, 11, 31), // End of year
          closed_date: dealData.stage === 'Closed Won' ? new Date() : null,
          created_date: new Date(),
          crm_type: 'manual',
          user_id: user.id,
          company_id: originalCompany.id
        }
      });
      
      dealCount++;
      console.log(`  ✅ Created deal "${dealData.name}" for ${user.email}`);
    }
    
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`  • Feature branch data preserved with @test2.com emails`);
    console.log(`  • Fresh @test.com users created for main branch testing`);
    console.log(`  • ${users.length} users created with basic targets`);
    console.log(`  • ${dealCount} sample deals created`);
    console.log('');
    console.log('🔑 Test Accounts (password: password123):');
    console.log('  Main Branch Testing:');
    console.log('    • tom@test.com (manager/admin)');
    console.log('    • sarah@test.com (manager/admin)'); 
    console.log('    • alex@test.com (sales_rep)');
    console.log('    • mike@test.com (sales_rep)');
    console.log('');
    console.log('  Feature Branch Testing (preserved):');
    console.log('    • tom@test2.com (all advanced features)');
    console.log('    • joel@test2.com (all advanced features)');
    console.log('    • alfie@test2.com, rob@test2.com, etc...');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
cleanupAndCreateFresh()
  .catch((error) => {
    console.error('Migration error:', error);
    process.exit(1);
  });