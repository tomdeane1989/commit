// Script to create test commission records for approval workflow testing
import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';

const prisma = new PrismaClient();

async function createTestCommissions() {
  console.log('🚀 Creating test commission records...\n');
  
  try {
    // Get Tom's user record
    const tom = await prisma.users.findFirst({
      where: { email: 'tom@test.com' }
    });
    
    if (!tom) {
      throw new Error('Tom user not found');
    }
    
    // Get existing closed won deals
    const closedDeals = await prisma.deals.findMany({
      where: {
        company_id: tom.company_id,
        status: 'closed_won'
      },
      take: 5
    });
    
    console.log(`Found ${closedDeals.length} closed deals to create commissions for`);
    
    // Get active target for commission rate
    const activeTarget = await prisma.targets.findFirst({
      where: {
        user_id: tom.id,
        is_active: true
      }
    });
    
    const commissionRate = activeTarget?.commission_rate || 0.05;
    
    // Create commission records for closed deals
    let createdCount = 0;
    for (const deal of closedDeals) {
      // Check if commission already exists
      const existingCommission = await prisma.commissions.findUnique({
        where: { deal_id: deal.id }
      });
      
      if (!existingCommission) {
        const commissionAmount = new Decimal(deal.amount).mul(commissionRate);
        
        const commission = await prisma.commissions.create({
          data: {
            deal_id: deal.id,
            user_id: deal.user_id,
            company_id: deal.company_id,
            deal_amount: deal.amount,
            commission_rate: commissionRate,
            commission_amount: commissionAmount.toFixed(2),
            target_id: activeTarget?.id,
            target_name: activeTarget ? `${activeTarget.period_type} Target` : null,
            period_start: activeTarget?.period_start || new Date(),
            period_end: activeTarget?.period_end || new Date(),
            status: 'calculated',
            calculated_at: new Date(),
            calculated_by: tom.id,
            notes: JSON.stringify({
              created_by: 'test_script',
              purpose: 'testing_approval_workflow'
            })
          }
        });
        
        // Create initial approval record
        await prisma.commission_approvals.create({
          data: {
            commission_id: commission.id,
            action: 'calculated',
            performed_by: tom.id,
            performed_at: new Date(),
            previous_status: 'new',
            new_status: 'calculated',
            metadata: {
              source: 'test_script'
            }
          }
        });
        
        console.log(`✅ Created commission for deal: ${deal.deal_name} - £${commissionAmount.toFixed(2)}`);
        createdCount++;
      } else {
        console.log(`⏭️  Commission already exists for deal: ${deal.deal_name}`);
      }
    }
    
    // Create some commissions in different states for testing
    const statuses = ['pending_review', 'approved'];
    for (let i = 0; i < 2; i++) {
      const testDeal = closedDeals[i];
      if (testDeal) {
        const existingCommission = await prisma.commissions.findUnique({
          where: { deal_id: testDeal.id }
        });
        
        if (existingCommission && existingCommission.status === 'calculated') {
          const newStatus = statuses[i];
          await prisma.commissions.update({
            where: { id: existingCommission.id },
            data: { 
              status: newStatus,
              reviewed_at: newStatus === 'pending_review' ? new Date() : null,
              reviewed_by: newStatus === 'pending_review' ? tom.id : null,
              approved_at: newStatus === 'approved' ? new Date() : null,
              approved_by: newStatus === 'approved' ? tom.id : null
            }
          });
          
          await prisma.commission_approvals.create({
            data: {
              commission_id: existingCommission.id,
              action: newStatus === 'pending_review' ? 'review' : 'approve',
              performed_by: tom.id,
              performed_at: new Date(),
              previous_status: 'calculated',
              new_status: newStatus,
              notes: `Set to ${newStatus} for testing`
            }
          });
          
          console.log(`📝 Updated commission to ${newStatus}: ${testDeal.deal_name}`);
        }
      }
    }
    
    console.log(`\n✅ Created/updated ${createdCount} commission records`);
    
    // Get summary
    const summary = await prisma.commissions.groupBy({
      by: ['status'],
      where: { company_id: tom.company_id },
      _count: { id: true },
      _sum: { commission_amount: true }
    });
    
    console.log('\n📊 Commission Summary:');
    summary.forEach(s => {
      console.log(`  ${s.status}: ${s._count.id} records - £${s._sum.commission_amount || 0}`);
    });
    
  } catch (error) {
    console.error('❌ Error creating test commissions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestCommissions();