import { PrismaClient } from '@prisma/client';
import { generateTargetName } from './utils/targetNaming.js';

const prisma = new PrismaClient();

async function fixCommissionIssues() {
  console.log('🔧 Fixing commission issues...\n');
  
  try {
    // 1. Fix target naming for all commission records
    console.log('Step 1: Fixing target naming convention...');
    const commissions = await prisma.commissions.findMany({
      where: {
        OR: [
          { target_name: { contains: ' - ' } },
          { target_name: { contains: 'GMT' } },
          { target_name: null }
        ]
      },
      include: {
        user: {
          select: { first_name: true, last_name: true }
        },
        target: true
      }
    });
    
    console.log(`Found ${commissions.length} commissions with old naming format`);
    
    let fixedNaming = 0;
    for (const commission of commissions) {
      if (commission.target) {
        const newTargetName = generateTargetName(
          commission.user,
          commission.target.period_type,
          commission.target.period_start,
          commission.target.period_end
        );
        
        await prisma.commissions.update({
          where: { id: commission.id },
          data: { target_name: newTargetName }
        });
        
        console.log(`  ✅ Fixed: ${commission.user.first_name} ${commission.user.last_name} -> ${newTargetName}`);
        fixedNaming++;
      }
    }
    
    // 2. Fix commission rates that are mismatched
    console.log('\nStep 2: Fixing commission rate mismatches...');
    const mismatched = await prisma.commissions.findMany({
      where: {
        NOT: {
          deal: {
            commission_rate: prisma.commissions.commission_rate
          }
        }
      },
      include: {
        deal: true,
        target: true,
        user: { select: { first_name: true, last_name: true } }
      }
    });
    
    // Actually need to use raw query for this comparison
    const mismatchedCommissions = await prisma.$queryRaw`
      SELECT c.id, c.commission_amount, c.commission_rate as comm_rate, 
             d.commission_amount as deal_comm_amount, d.commission_rate as deal_rate,
             d.deal_name, d.amount as deal_amount,
             u.first_name, u.last_name
      FROM commissions c
      JOIN deals d ON c.deal_id = d.id
      JOIN users u ON c.user_id = u.id
      WHERE c.commission_amount != d.commission_amount
         OR c.commission_rate != d.commission_rate
    `;
    
    console.log(`Found ${mismatchedCommissions.length} commissions with rate mismatches`);
    
    let fixedRates = 0;
    for (const mismatch of mismatchedCommissions) {
      // The deal record is the source of truth since it was calculated at close time
      // Update commission record to match
      await prisma.commissions.update({
        where: { id: mismatch.id },
        data: {
          commission_rate: parseFloat(mismatch.deal_rate),
          commission_amount: parseFloat(mismatch.deal_comm_amount)
        }
      });
      
      console.log(`  ✅ Fixed: ${mismatch.first_name} ${mismatch.last_name} - ${mismatch.deal_name}`);
      console.log(`     Was: ${(mismatch.comm_rate * 100).toFixed(1)}% = £${mismatch.commission_amount}`);
      console.log(`     Now: ${(mismatch.deal_rate * 100).toFixed(1)}% = £${mismatch.deal_comm_amount}`);
      fixedRates++;
    }
    
    // 3. Recalculate commissions for deals that are showing wrong rates
    console.log('\nStep 3: Recalculating deals with 5% rate that should be 10%...');
    const wrongRateDeals = await prisma.deals.findMany({
      where: {
        stage: { in: ['Closed Won', 'closed_won'] },
        commission_rate: 0.05,
        close_date: {
          gte: new Date('2025-01-01')
        }
      },
      include: {
        user: { select: { id: true, first_name: true, last_name: true } }
      }
    });
    
    console.log(`Found ${wrongRateDeals.length} deals with 5% rate in 2025`);
    
    let recalculated = 0;
    for (const deal of wrongRateDeals) {
      // Check if there's an active 10% target
      const activeTarget = await prisma.targets.findFirst({
        where: {
          user_id: deal.user_id,
          is_active: true,
          period_start: { lte: deal.close_date },
          period_end: { gte: deal.close_date },
          commission_rate: 0.10
        }
      });
      
      if (activeTarget) {
        const correctCommission = deal.amount * 0.10;
        
        // Update deal
        await prisma.deals.update({
          where: { id: deal.id },
          data: {
            commission_rate: 0.10,
            commission_amount: correctCommission,
            commission_calculated_at: new Date()
          }
        });
        
        // Update commission record if exists
        const commissionRecord = await prisma.commissions.findUnique({
          where: { deal_id: deal.id }
        });
        
        if (commissionRecord) {
          const targetName = generateTargetName(
            deal.user,
            activeTarget.period_type,
            activeTarget.period_start,
            activeTarget.period_end
          );
          
          await prisma.commissions.update({
            where: { id: commissionRecord.id },
            data: {
              commission_rate: 0.10,
              commission_amount: correctCommission,
              target_name: targetName,
              target_id: activeTarget.id
            }
          });
        }
        
        console.log(`  ✅ Recalculated: ${deal.user.first_name} ${deal.user.last_name} - ${deal.deal_name}`);
        console.log(`     Was: 5% = £${deal.amount * 0.05}`);
        console.log(`     Now: 10% = £${correctCommission}`);
        recalculated++;
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`  - Fixed ${fixedNaming} target names`);
    console.log(`  - Fixed ${fixedRates} rate mismatches`);
    console.log(`  - Recalculated ${recalculated} commissions`);
    
  } catch (error) {
    console.error('❌ Error fixing commissions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixCommissionIssues();