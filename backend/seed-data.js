import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  try {
    // Check if database already has data - if so, skip seeding
    const existingUserCount = await prisma.users.count();
    const existingCompanyCount = await prisma.companies.count();
    
    if (existingUserCount > 0 || existingCompanyCount > 0) {
      console.log('📊 Database already contains data:');
      console.log(`   - ${existingUserCount} users`);
      console.log(`   - ${existingCompanyCount} companies`);
      console.log('🔄 Skipping seed data to preserve existing data');
      console.log('💡 To force re-seeding, manually clear the database first');
      return;
    }

    console.log('📭 Database is empty - proceeding with seed data...');

    // First, ensure we have the test company and user
    let testCompany = await prisma.companies.findFirst({
      where: { name: 'Test Company' }
    });

    if (!testCompany) {
      console.log('Creating Test Company...');
      testCompany = await prisma.companies.create({
        data: {
          name: 'Test Company',
          domain: 'testcompany.com',
          subscription: 'trial',
          fiscal_year_start: 1,
          default_commission_rate: 0.0500
        }
      });
    }

    let testUser = await prisma.users.findFirst({
      where: { email: 'test@company.com' }
    });

    if (!testUser) {
      console.log('Creating test user...');
      const hashedPassword = await bcrypt.hash('password123', 10);
      testUser = await prisma.users.create({
        data: {
          email: 'test@company.com',
          password: hashedPassword,
          first_name: 'Sarah',
          last_name: 'Mitchell',
          role: 'admin',
          company_id: testCompany.id,
          hire_date: new Date('2024-01-15'),
          territory: 'UK North'
        }
      });
    }

    console.log(`✓ Company: ${testCompany.name} (${testCompany.id})`);
    console.log(`✓ User: ${testUser.first_name} ${testUser.last_name} (${testUser.id})`);

    // Create active target for Q3 2025 (current quarter)
    console.log('Creating active target...');
    const existingTarget = await prisma.targets.findFirst({
      where: {
        user_id: testUser.id,
        is_active: true
      }
    });

    let activeTarget;
    if (!existingTarget) {
      activeTarget = await prisma.targets.create({
        data: {
          user_id: testUser.id,
          company_id: testCompany.id,
          period_type: 'annual', // Annual quota to be divided by periods
          period_start: new Date('2025-01-01'),
          period_end: new Date('2025-12-31'),
          quota_amount: 250000.00, // Annual quota
          commission_rate: 0.0750, // 7.5%
          is_active: true
        }
      });
    } else {
      activeTarget = existingTarget;
    }

    console.log(`✓ Active Target: £${activeTarget.quota_amount.toLocaleString()} Annual 2025`);

    // Create seed deals - mix of open opportunities and closed deals
    console.log('Creating seed deals...');

    const seedDeals = [
      // Closed Won Deals (Historical Q4 2024)
      {
        deal_name: 'Enterprise Software License - TechCorp',
        account_name: 'TechCorp Industries',
        amount: 45000.00,
        probability: 100,
        status: 'closed_won',
        stage: 'Closed Won',
        close_date: new Date('2024-12-15'),
        closed_date: new Date('2024-12-15'),
        created_date: new Date('2024-10-01'),
        crm_type: 'salesforce',
        crm_id: 'SF001'
      },
      {
        deal_name: 'Annual Support Contract - DataFlow',
        account_name: 'DataFlow Solutions',
        amount: 28000.00,
        probability: 100,
        status: 'closed_won',
        stage: 'Closed Won',
        close_date: new Date('2024-12-22'),
        closed_date: new Date('2024-12-22'),
        created_date: new Date('2024-11-01'),
        crm_type: 'salesforce',
        crm_id: 'SF002'
      },
      {
        deal_name: 'Cloud Migration Services - RetailPlus',
        account_name: 'RetailPlus Ltd',
        amount: 67000.00,
        probability: 100,
        status: 'closed_won',
        stage: 'Closed Won',
        close_date: new Date('2024-11-30'),
        closed_date: new Date('2024-11-30'),
        created_date: new Date('2024-09-15'),
        crm_type: 'hubspot',
        crm_id: 'HS001'
      },

      // Current Quarter Closed Won Deals (Q3 2025 - for quota tracking)
      {
        deal_name: 'Security Assessment - SecureBank',
        account_name: 'SecureBank Financial',
        amount: 22000.00,
        probability: 100,
        status: 'closed_won',
        stage: 'Closed Won',
        close_date: new Date('2025-07-05'),
        closed_date: new Date('2025-07-05'),
        created_date: new Date('2025-05-15'),
        crm_type: 'salesforce',
        crm_id: 'SF008'
      },
      {
        deal_name: 'Quick Implementation - StartupXYZ',
        account_name: 'StartupXYZ Inc',
        amount: 15000.00,
        probability: 100,
        status: 'closed_won',
        stage: 'Closed Won',
        close_date: new Date('2025-07-12'),
        closed_date: new Date('2025-07-12'),
        created_date: new Date('2025-06-01'),
        crm_type: 'hubspot',
        crm_id: 'HS005'
      },

      // Open Opportunities - Pipeline (Uncategorized)
      {
        deal_name: 'Digital Transformation - MegaCorp',
        account_name: 'MegaCorp International',
        amount: 120000.00,
        probability: 75,
        status: 'open',
        stage: 'Proposal Submitted',
        close_date: new Date('2025-08-28'),
        created_date: new Date('2025-06-01'),
        crm_type: 'salesforce',
        crm_id: 'SF003'
      },
      // Overdue deals for testing
      {
        deal_name: 'Overdue Implementation - TechLate',
        account_name: 'TechLate Solutions',
        amount: 35000.00,
        probability: 80,
        status: 'open',
        stage: 'Final Approval',
        close_date: new Date('2025-07-10'), // 11 days overdue
        created_date: new Date('2025-05-20'),
        crm_type: 'salesforce',
        crm_id: 'SF009'
      },
      {
        deal_name: 'Delayed Migration - SlowCorp',
        account_name: 'SlowCorp Industries',
        amount: 48000.00,
        probability: 65,
        status: 'open',
        stage: 'Contract Negotiation',
        close_date: new Date('2025-07-05'), // 16 days overdue
        created_date: new Date('2025-04-15'),
        crm_type: 'hubspot',
        crm_id: 'HS006'
      },
      {
        deal_name: 'Security Audit & Implementation - FinanceFirst',
        account_name: 'FinanceFirst Bank',
        amount: 85000.00,
        probability: 60,
        status: 'open',
        stage: 'Needs Analysis',
        close_date: new Date('2025-09-15'),
        created_date: new Date('2025-05-15'),
        crm_type: 'salesforce',
        crm_id: 'SF004'
      },
      {
        deal_name: 'CRM Integration - StartupFast',
        account_name: 'StartupFast Technologies',
        amount: 32000.00,
        probability: 45,
        status: 'open',
        stage: 'Initial Meeting',
        close_date: new Date('2025-08-15'),
        created_date: new Date('2025-07-05'),
        crm_type: 'hubspot',
        crm_id: 'HS002'
      },
      {
        deal_name: 'Infrastructure Upgrade - ManufacturingCo',
        account_name: 'ManufacturingCo Ltd',
        amount: 95000.00,
        probability: 70,
        status: 'open',
        stage: 'Technical Evaluation',
        close_date: new Date('2025-03-30'),
        created_date: new Date('2024-12-10'),
        crm_type: 'pipedrive',
        crm_id: 'PD001'
      },
      {
        deal_name: 'Analytics Platform - InsightsCorp',
        account_name: 'InsightsCorp',
        amount: 52000.00,
        probability: 55,
        status: 'open',
        stage: 'Demo Scheduled',
        close_date: new Date('2025-02-20'),
        created_date: new Date('2025-01-02'),
        crm_type: 'salesforce',
        crm_id: 'SF005'
      },
      {
        deal_name: 'Training & Consulting - EduTech',
        account_name: 'EduTech Solutions',
        amount: 18500.00,
        probability: 40,
        status: 'open',
        stage: 'Qualification',
        close_date: new Date('2025-01-31'),
        created_date: new Date('2024-12-20'),
        crm_type: 'hubspot',
        crm_id: 'HS003'
      },

      // Some pre-categorized deals for testing drag-and-drop
      {
        deal_name: 'Enterprise License Renewal - GlobalTech',
        account_name: 'GlobalTech Systems',
        amount: 75000.00,
        probability: 85,
        status: 'open',
        stage: 'Contract Review',
        close_date: new Date('2025-07-25'), // Current month
        created_date: new Date('2025-06-01'),
        crm_type: 'salesforce',
        crm_id: 'SF006'
      },
      {
        deal_name: 'Custom Development - InnovateLabs',
        account_name: 'InnovateLabs',
        amount: 42000.00,
        probability: 90,
        status: 'open',
        stage: 'Verbal Commitment',
        close_date: new Date('2025-02-10'),
        created_date: new Date('2024-12-05'),
        crm_type: 'hubspot',
        crm_id: 'HS004'
      },
      {
        deal_name: 'Strategic Partnership - FutureCorp',
        account_name: 'FutureCorp Ventures',
        amount: 150000.00,
        probability: 35,
        status: 'open',
        stage: 'Exploratory',
        close_date: new Date('2025-07-30'), // Current month
        created_date: new Date('2025-05-15'),
        crm_type: 'salesforce',
        crm_id: 'SF007'
      },
      {
        deal_name: 'International Expansion - GlobalReach',
        account_name: 'GlobalReach International',
        amount: 200000.00,
        probability: 25,
        status: 'open',
        stage: 'Research Phase',
        close_date: new Date('2025-06-30'),
        created_date: new Date('2024-11-20'),
        crm_type: 'pipedrive',
        crm_id: 'PD002'
      }
    ];

    // Insert all deals
    const createdDeals = [];
    for (const dealData of seedDeals) {
      const deal = await prisma.deals.create({
        data: {
          ...dealData,
          user_id: testUser.id,
          company_id: testCompany.id,
          deal_age_days: Math.floor((new Date() - dealData.created_date) / (1000 * 60 * 60 * 24)),
          ai_probability: dealData.probability + Math.floor(Math.random() * 10 - 5), // Add some AI variance
          ai_insights: {
            confidence: dealData.probability > 70 ? 'high' : dealData.probability > 40 ? 'medium' : 'low',
            risk_factors: dealData.probability < 50 ? ['Timeline pressure', 'Budget constraints'] : [],
            similar_deals_count: Math.floor(Math.random() * 5) + 1
          }
        }
      });
      createdDeals.push(deal);
    }

    console.log(`✓ Created ${createdDeals.length} deals`);

    // Create minimal deal categorizations for testing drag-and-drop functionality
    console.log('Creating sample deal categorizations for testing...');
    
    // Only categorize 1-2 deals to demonstrate the functionality
    // Most deals should remain in "pipeline" to show realistic CRM sync
    const commitDeals = [
      'Enterprise License Renewal - GlobalTech',  // High-confidence deal
      'Overdue Implementation - TechLate'         // Overdue deal to test quota calculation
    ];
    
    const bestCaseDeals = [
      'Strategic Partnership - FutureCorp'  // Only 1 speculative deal
    ];

    const commitDealIds = createdDeals
      .filter(deal => commitDeals.includes(deal.deal_name))
      .map(deal => deal.id);
      
    const bestCaseDealIds = createdDeals
      .filter(deal => bestCaseDeals.includes(deal.deal_name))
      .map(deal => deal.id);

    // Create minimal categorizations (most deals stay in pipeline)
    for (const dealId of commitDealIds) {
      await prisma.deal_categorizations.create({
        data: {
          deal_id: dealId,
          user_id: testUser.id,
          category: 'commit',
          confidence_note: 'High confidence - contract review stage with verbal commitment'
        }
      });
    }

    for (const dealId of bestCaseDealIds) {
      await prisma.deal_categorizations.create({
        data: {
          deal_id: dealId,
          user_id: testUser.id,
          category: 'best_case',
          confidence_note: 'Long-term opportunity - exploring partnership potential'
        }
      });
    }

    console.log(`✓ Created ${commitDealIds.length + bestCaseDealIds.length} deal categorizations (${createdDeals.filter(d => d.status === 'open').length - commitDealIds.length - bestCaseDealIds.length} deals remain in pipeline)`);

    // Create some commission records for closed deals
    console.log('Creating commission records...');
    
    const closedDeals = createdDeals.filter(deal => deal.status === 'closed_won');
    const totalClosedAmount = closedDeals.reduce((sum, deal) => sum + Number(deal.amount), 0);
    
    if (closedDeals.length > 0) {
      const quotaAmount = 200000.00;
      const attainmentPct = Math.min((Number(totalClosedAmount) / quotaAmount) * 100, 999.99);
      const commissionEarned = Math.min(Number(totalClosedAmount) * 0.0750, 99999.99);
      
      console.log(`Commission calculation: totalClosed=${totalClosedAmount}, commission=${commissionEarned}`);
      
      await prisma.commissions.create({
        data: {
          user_id: testUser.id,
          company_id: testCompany.id,
          target_id: activeTarget.id,
          period_start: new Date('2024-10-01'),
          period_end: new Date('2024-12-31'),
          quota_amount: quotaAmount,
          actual_amount: Number(totalClosedAmount),
          attainment_pct: attainmentPct,
          commission_rate: 0.0750,
          commission_earned: commissionEarned,
          base_commission: commissionEarned,
          bonus_commission: 0,
          status: 'calculated'
        }
      });
    }

    // Add some activity log entries
    console.log('Creating activity log entries...');
    
    for (let i = 0; i < 5; i++) {
      await prisma.activity_log.create({
        data: {
          user_id: testUser.id,
          company_id: testCompany.id,
          action: 'deal_categorized',
          entity_type: 'deal',
          entity_id: createdDeals[i]?.id || createdDeals[0].id,
          before_state: { category: 'pipeline' },
          after_state: { category: 'commit' },
          context: {
            source: 'seed_data',
            user_agent: 'Seed Script'
          },
          success: true
        }
      });
    }

    // Summary
    console.log('\n🎉 Database seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   Company: ${testCompany.name}`);
    console.log(`   User: ${testUser.first_name} ${testUser.last_name} (${testUser.email})`);
    console.log(`   Active Target: £${activeTarget.quota_amount.toLocaleString()} (Q1 2025)`);
    console.log(`   Total Deals: ${createdDeals.length}`);
    console.log(`   - Closed Won: ${closedDeals.length} (£${totalClosedAmount.toLocaleString()})`);
    console.log(`   - Pipeline (CRM synced): ${createdDeals.filter(d => d.status === 'open').length - commitDealIds.length - bestCaseDealIds.length}`);
    console.log(`   - Commit (user categorized): ${commitDealIds.length}`);
    console.log(`   - Best Case (user categorized): ${bestCaseDealIds.length}`);
    console.log('\n🔑 Login with:');
    console.log('   Email: test@company.com');
    console.log('   Password: password123');
    console.log('\n🚀 Ready to test the UI!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedDatabase()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });