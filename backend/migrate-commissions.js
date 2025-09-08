// Script to create commission audit records for closed deals with calculated commissions
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateCommissions() {
  console.log('🚀 Migrating commission calculations to audit records...\n');
  
  try {
    // Find all closed deals with calculated commissions but no audit record
    const closedDealsWithCommission = await prisma.deals.findMany({
      where: {
        status: 'closed_won',
        stage: { in: ['closed_won', 'Closed Won', 'closedwon'] },
        commission_amount: { not: null },
        commission: null // No existing commission record
      },
      include: {
        user: true,
        company: true
      }
    });
    
    console.log(`Found ${closedDealsWithCommission.length} deals needing commission records`);
    
    let created = 0;
    let errors = 0;
    
    for (const deal of closedDealsWithCommission) {
      try {
        // Find the active target for this deal's period
        const target = await prisma.targets.findFirst({
          where: {
            user_id: deal.user_id,
            is_active: true,
            period_start: { lte: deal.close_date },
            period_end: { gte: deal.close_date }
          }
        });
        
        // Create commission audit record
        const commission = await prisma.commissions.create({
          data: {
            deal_id: deal.id,
            user_id: deal.user_id,
            company_id: deal.company_id,
            
            // Snapshot data
            deal_amount: deal.amount,
            commission_rate: deal.commission_rate || 0,
            commission_amount: deal.commission_amount,
            target_id: target?.id,
            target_name: target ? `${target.period_type} Target` : 'No Target',
            period_start: target?.period_start || deal.close_date,
            period_end: target?.period_end || deal.close_date,
            
            // Workflow fields
            status: 'calculated', // Start in calculated status for approval
            calculated_at: deal.commission_calculated_at || new Date(),
            calculated_by: deal.user_id,
            
            // Notes
            notes: `Migrated from deal commission calculation on ${new Date().toISOString()}`
          }
        });
        
        console.log(`✅ Created commission record for deal: ${deal.deal_name} (${deal.account_name})`);
        created++;
        
      } catch (error) {
        console.error(`❌ Error creating commission for deal ${deal.id}:`, error.message);
        errors++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`   - Successfully created: ${created} commission records`);
    console.log(`   - Errors: ${errors}`);
    
    // Get summary by user
    const userSummary = await prisma.commissions.groupBy({
      by: ['user_id'],
      where: {
        status: 'calculated',
        created_at: {
          gte: new Date(Date.now() - 60000) // Created in last minute
        }
      },
      _count: true,
      _sum: {
        commission_amount: true
      }
    });
    
    if (userSummary.length > 0) {
      console.log('\n📈 Commission records by user:');
      for (const summary of userSummary) {
        const user = await prisma.users.findUnique({
          where: { id: summary.user_id },
          select: { first_name: true, last_name: true, email: true }
        });
        console.log(`   - ${user.first_name} ${user.last_name}: ${summary._count} deals, £${summary._sum.commission_amount?.toFixed(2) || '0.00'} total`);
      }
    }
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateCommissions().catch(console.error);