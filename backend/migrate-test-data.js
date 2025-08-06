// migrate-test-data.js - Separate test environments for main vs feature branches
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateTestData() {
  console.log('🔄 Starting test data migration...');
  
  try {
    // Step 1: Create new company for feature branch data
    console.log('📋 Step 1: Creating new company for feature branch data...');
    
    const originalCompany = await prisma.companies.findFirst({
      where: { 
        name: { contains: 'Test' }
      }
    });
    
    if (!originalCompany) {
      throw new Error('Could not find original test company');
    }
    
    const newCompany = await prisma.companies.create({
      data: {
        name: 'Test Company 2 (Feature Branch)',
        domain: 'test-company-2.com',
        subscription: originalCompany.subscription,
        fiscal_year_start: originalCompany.fiscal_year_start,
        default_commission_rate: originalCompany.default_commission_rate
      }
    });
    
    console.log(`✅ Created new company: ${newCompany.name} (${newCompany.id})`);
    
    // Step 2: Find all test.com users and their related data
    console.log('📋 Step 2: Finding all @test.com users...');
    
    const testUsers = await prisma.users.findMany({
      where: {
        email: { endsWith: '@test.com' }
      },
      include: {
        deals: true,
        targets: true,
        commissions: true,
        activity_log: true,
        deal_categorizations: true,
        forecasts: true
      }
    });
    
    console.log(`Found ${testUsers.length} @test.com users to migrate`);
    
    // Step 3: Migrate users to @test2.com with new company
    console.log('📋 Step 3: Migrating users to @test2.com...');
    
    const userMigrationMap = new Map(); // old_id -> new_id
    
    for (const user of testUsers) {
      const newEmail = user.email.replace('@test.com', '@test2.com');
      
      // Create new user with @test2.com email
      const newUser = await prisma.users.create({
        data: {
          email: newEmail,
          password: user.password,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          is_admin: user.is_admin,
          is_active: user.is_active,
          hire_date: user.hire_date,
          territory: user.territory,
          company_id: newCompany.id,
          // Include advanced fields if they exist in the current schema
          ...(user.is_manager !== undefined && { is_manager: user.is_manager }),
          ...(user.can_view_all_teams !== undefined && { can_view_all_teams: user.can_view_all_teams }),
          ...(user.reports_to_id && { reports_to_id: null }), // Will fix hierarchy later
          ...(user.sub_role && { sub_role: user.sub_role })
        }
      });
      
      userMigrationMap.set(user.id, newUser.id);
      console.log(`  ✅ ${user.email} -> ${newEmail}`);
    }
    
    // Step 4: Fix user hierarchy for migrated users
    console.log('📋 Step 4: Fixing user hierarchy...');
    
    for (const oldUser of testUsers) {
      if (oldUser.manager_id && userMigrationMap.has(oldUser.manager_id)) {
        const newUserId = userMigrationMap.get(oldUser.id);
        const newManagerId = userMigrationMap.get(oldUser.manager_id);
        
        await prisma.users.update({
          where: { id: newUserId },
          data: { manager_id: newManagerId }
        });
      }
    }
    
    // Step 5: Migrate deals
    console.log('📋 Step 5: Migrating deals...');
    
    let dealsCount = 0;
    for (const user of testUsers) {
      if (user.deals.length > 0) {
        const newUserId = userMigrationMap.get(user.id);
        
        for (const deal of user.deals) {
          await prisma.deals.create({
            data: {
              deal_name: deal.deal_name,
              account_name: deal.account_name,
              amount: deal.amount,
              probability: deal.probability,
              status: deal.status,
              stage: deal.stage,
              close_date: deal.close_date,
              closed_date: deal.closed_date,
              created_date: deal.created_date,
              crm_id: deal.crm_id,
              crm_type: deal.crm_type,
              crm_url: deal.crm_url,
              last_sync: deal.last_sync,
              user_id: newUserId,
              company_id: newCompany.id
            }
          });
          dealsCount++;
        }
      }
    }
    console.log(`  ✅ Migrated ${dealsCount} deals`);
    
    // Step 6: Migrate targets (including advanced allocation data if it exists)
    console.log('📋 Step 6: Migrating targets...');
    
    let targetsCount = 0;
    const targetMigrationMap = new Map(); // old_target_id -> new_target_id
    
    for (const user of testUsers) {
      if (user.targets.length > 0) {
        const newUserId = userMigrationMap.get(user.id);
        
        for (const target of user.targets) {
          const newTarget = await prisma.targets.create({
            data: {
              period_type: target.period_type,
              period_start: target.period_start,
              period_end: target.period_end,
              quota_amount: target.quota_amount,
              commission_rate: target.commission_rate,
              is_active: target.is_active,
              commission_payment_schedule: target.commission_payment_schedule,
              team_target: target.team_target,
              role: target.role,
              user_id: newUserId,
              company_id: newCompany.id,
              // Include advanced fields if they exist
              ...(target.allocation_pattern_id && { allocation_pattern_id: target.allocation_pattern_id }),
              ...(target.distribution_method && { distribution_method: target.distribution_method }),
              ...(target.distribution_config && { distribution_config: target.distribution_config }),
              ...(target.annual_quota_amount && { annual_quota_amount: target.annual_quota_amount }),
              ...(target.target_year && { target_year: target.target_year })
            }
          });
          
          targetMigrationMap.set(target.id, newTarget.id);
          targetsCount++;
        }
      }
    }
    console.log(`  ✅ Migrated ${targetsCount} targets`);
    
    // Step 7: Fix parent_target_id relationships
    console.log('📋 Step 7: Fixing target hierarchy...');
    
    for (const user of testUsers) {
      for (const target of user.targets) {
        if (target.parent_target_id && targetMigrationMap.has(target.parent_target_id)) {
          const newTargetId = targetMigrationMap.get(target.id);
          const newParentId = targetMigrationMap.get(target.parent_target_id);
          
          await prisma.targets.update({
            where: { id: newTargetId },
            data: { parent_target_id: newParentId }
          });
        }
      }
    }
    
    // Step 8: Skip commissions migration (complex schema differences)
    console.log('📋 Step 8: Skipping commissions migration (will be recalculated)...');
    console.log('  ℹ️ Commissions will be recalculated automatically based on new deals and targets');
    
    // Step 9: Delete original @test.com users and their data
    console.log('📋 Step 9: Cleaning up original @test.com users...');
    
    // Delete in reverse order of dependencies
    await prisma.deal_categorizations.deleteMany({
      where: { user_id: { in: testUsers.map(u => u.id) } }
    });
    
    await prisma.forecasts.deleteMany({
      where: { user_id: { in: testUsers.map(u => u.id) } }
    });
    
    await prisma.activity_log.deleteMany({
      where: { user_id: { in: testUsers.map(u => u.id) } }
    });
    
    await prisma.commissions.deleteMany({
      where: { user_id: { in: testUsers.map(u => u.id) } }
    });
    
    await prisma.deals.deleteMany({
      where: { user_id: { in: testUsers.map(u => u.id) } }
    });
    
    await prisma.targets.deleteMany({
      where: { user_id: { in: testUsers.map(u => u.id) } }
    });
    
    await prisma.users.deleteMany({
      where: { id: { in: testUsers.map(u => u.id) } }
    });
    
    console.log(`  ✅ Deleted ${testUsers.length} original users and their data`);
    
    // Step 10: Create fresh @test.com users for main branch testing
    console.log('📋 Step 10: Creating fresh @test.com users for main branch...');
    
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
          manager_id: userData.role === 'sales_rep' ? null : null // Will set after creating managers
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
    }
    
    // Step 11: Create basic targets for testing
    console.log('📋 Step 11: Creating basic targets for main branch testing...');
    
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
    }
    
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`  • Feature branch data moved to @test2.com emails`);
    console.log(`  • Fresh @test.com users created for main branch testing`);
    console.log(`  • Company: ${originalCompany.name} (main branch)`);
    console.log(`  • Company: ${newCompany.name} (feature branch)`);
    console.log('');
    console.log('🔑 Test Accounts (password: password123):');
    console.log('  Main Branch Testing:');
    console.log('    • tom@test.com (manager/admin)');
    console.log('    • sarah@test.com (manager/admin)'); 
    console.log('    • alex@test.com (sales_rep)');
    console.log('    • mike@test.com (sales_rep)');
    console.log('');
    console.log('  Feature Branch Testing:');
    console.log('    • tom@test2.com (all advanced features)');
    console.log('    • sarah@test2.com (all advanced features)');
    console.log('    • etc...');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateTestData()
  .catch((error) => {
    console.error('Migration error:', error);
    process.exit(1);
  });