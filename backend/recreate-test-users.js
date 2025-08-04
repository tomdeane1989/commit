// recreate-test-users.js - Recreate @test.com users to match @test2.com structure
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function recreateTestUsers() {
  console.log('🔄 Recreating @test.com users to match @test2.com structure...');
  
  try {
    // Step 1: Find or create the Test Company
    let testCompany = await prisma.companies.findFirst({
      where: { name: 'Test Company' }
    });

    if (!testCompany) {
      console.log('Creating Test Company...');
      testCompany = await prisma.companies.create({
        data: {
          name: 'Test Company',
          domain: 'test.com',
          subscription: 'premium',
          fiscal_year_start: 1,
          default_commission_rate: 0.0500
        }
      });
    }
    
    console.log(`✓ Company: ${testCompany.name} (${testCompany.id})`);

    // Step 2: Delete existing @test.com users and their data
    console.log('🗑️  Cleaning up existing @test.com users...');
    
    const existingTestUsers = await prisma.users.findMany({
      where: {
        email: { endsWith: '@test.com' }
      }
    });
    
    if (existingTestUsers.length > 0) {
      const userIds = existingTestUsers.map(u => u.id);
      
      // Delete in reverse order of dependencies
      await prisma.deal_categorizations.deleteMany({
        where: { user_id: { in: userIds } }
      });
      
      await prisma.forecasts.deleteMany({
        where: { user_id: { in: userIds } }
      });
      
      await prisma.activity_log.deleteMany({
        where: { user_id: { in: userIds } }
      });
      
      // Delete commission details first
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
      
      await prisma.deals.deleteMany({
        where: { user_id: { in: userIds } }
      });
      
      await prisma.targets.deleteMany({
        where: { user_id: { in: userIds } }
      });
      
      await prisma.users.deleteMany({
        where: { id: { in: userIds } }
      });
      
      console.log(`  ✅ Deleted ${existingTestUsers.length} existing @test.com users`);
    }

    // Step 3: Create fresh @test.com users matching @test2.com structure
    console.log('👥 Creating fresh @test.com users...');
    
    // Create standard password for all users
    const standardPassword = await bcrypt.hash('password123', 10);
    
    const users = [
      {
        email: 'target@test.com',
        password: standardPassword,
        first_name: 'Target',
        last_name: 'Test',
        role: 'manager',  // Changed from 'Team Lead' to standard role
        is_admin: true,
        is_active: true,
        territory: null,
        company_id: testCompany.id
      },
      {
        email: 'tom@test.com',
        password: standardPassword,
        first_name: 'Tom',
        last_name: 'Deane',
        role: 'sales_rep',  // Changed from 'New Sales' to standard role
        is_admin: true,     // Keeping admin flag as in test2
        is_active: true,
        territory: null,
        company_id: testCompany.id
      },
      {
        email: 'chris@test.com',
        password: standardPassword,
        first_name: 'Christian',
        last_name: 'Klotzbucher',
        role: 'sales_rep',
        is_admin: false,
        is_active: false,   // Inactive as in test2
        territory: null,
        company_id: testCompany.id
      },
      {
        email: 'rob@test.com',
        password: standardPassword,
        first_name: 'Rob',
        last_name: 'Manson',
        role: 'sales_rep',
        is_admin: false,
        is_active: true,
        territory: null,
        company_id: testCompany.id
      },
      {
        email: 'joel@test.com',
        password: standardPassword,
        first_name: 'Joel',
        last_name: 'Savilahti',
        role: 'sales_rep',
        is_admin: false,
        is_active: true,
        territory: null,
        company_id: testCompany.id
      },
      {
        email: 'alfie@test.com',
        password: standardPassword,
        first_name: 'Alfie',
        last_name: 'Ferris',
        role: 'sales_rep',
        is_admin: false,
        is_active: true,
        territory: null,
        company_id: testCompany.id
      },
      {
        email: 'tobias@test.com',
        password: standardPassword,
        first_name: 'Tobias',
        last_name: 'Zellweger',
        role: 'sales_rep',
        is_admin: false,
        is_active: true,
        territory: null,
        company_id: testCompany.id
      },
      {
        email: 'egger@test.com',
        password: standardPassword,
        first_name: 'Chris',
        last_name: 'Egger',
        role: 'sales_rep',
        is_admin: false,
        is_active: true,
        territory: null,
        company_id: testCompany.id
      }
    ];

    // Create users
    for (const userData of users) {
      const user = await prisma.users.create({
        data: userData
      });
      console.log(`  ✅ Created user: ${user.email} (${user.role}${user.is_admin ? ', admin' : ''}${!user.is_active ? ', inactive' : ''})`);
    }

    // Step 4: Create some sample deals for active users
    console.log('💼 Creating sample deals for active users...');
    
    const activeUsers = await prisma.users.findMany({
      where: {
        email: { endsWith: '@test.com' },
        is_active: true
      }
    });

    const dealTemplates = [
      { name: 'Enterprise Software License', amount: 45000, probability: 75, stage: 'Proposal' },
      { name: 'Annual Support Contract', amount: 28000, probability: 90, stage: 'Negotiation' },
      { name: 'Cloud Migration Services', amount: 67000, probability: 60, stage: 'Discovery' },
      { name: 'Marketing Automation Setup', amount: 15000, probability: 40, stage: 'Qualification' },
      { name: 'Data Analytics Platform', amount: 89000, probability: 85, stage: 'Contract Review' }
    ];

    let dealCount = 0;
    for (const user of activeUsers) {
      // Give each user 2-3 random deals
      const numDeals = Math.floor(Math.random() * 2) + 2;
      
      for (let i = 0; i < numDeals; i++) {
        const template = dealTemplates[Math.floor(Math.random() * dealTemplates.length)];
        const closeDate = new Date();
        closeDate.setDate(closeDate.getDate() + Math.floor(Math.random() * 90) + 30); // 30-120 days out
        
        await prisma.deals.create({
          data: {
            deal_name: `${template.name} - ${user.first_name}`,
            account_name: `Client ${Math.floor(Math.random() * 1000)}`,
            amount: template.amount,
            probability: template.probability,
            status: 'open',
            stage: template.stage,
            close_date: closeDate,
            created_date: new Date(),
            user_id: user.id,
            company_id: testCompany.id,
            crm_type: 'manual'
          }
        });
        dealCount++;
      }
    }
    
    console.log(`  ✅ Created ${dealCount} sample deals`);

    // Step 5: Create targets for the manager
    console.log('🎯 Creating targets for manager...');
    
    const manager = await prisma.users.findFirst({
      where: {
        email: 'target@test.com'
      }
    });

    if (manager) {
      const currentYear = new Date().getFullYear();
      await prisma.targets.create({
        data: {
          user_id: manager.id,
          company_id: testCompany.id,
          period_type: 'annual',
          period_start: new Date(`${currentYear}-01-01`),
          period_end: new Date(`${currentYear}-12-31`),
          quota_amount: 1000000.00, // £1M team target
          commission_rate: 0.0750, // 7.5%
          is_active: true
        }
      });
      console.log(`  ✅ Created annual target for ${manager.email}`);
    }

    console.log('\n✨ Recreation complete!');
    console.log('\n📝 Login credentials:');
    console.log('  Email: any @test.com email');
    console.log('  Password: password123');
    console.log('\n👥 Users created:');
    users.forEach(u => {
      console.log(`  - ${u.email} (${u.role}${u.is_admin ? ', admin' : ''}${!u.is_active ? ', inactive' : ''})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
recreateTestUsers();