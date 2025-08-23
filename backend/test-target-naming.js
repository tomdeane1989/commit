import { PrismaClient } from '@prisma/client';
import enhancedCommissionCalculator from './services/enhancedCommissionCalculator.js';

const prisma = new PrismaClient();

async function testTargetNaming() {
  try {
    // Find Alfie's deal
    const deal = await prisma.deals.findFirst({
      where: {
        deal_name: { contains: 'Organic Upsell' }
      }
    });
    
    if (!deal) {
      console.log('Deal not found');
      return;
    }
    
    console.log('Found deal:', deal.deal_name);
    
    // Delete existing commission record to test fresh creation
    await prisma.commission_approvals.deleteMany({
      where: {
        commission: {
          deal_id: deal.id
        }
      }
    });
    
    await prisma.commissions.deleteMany({
      where: { deal_id: deal.id }
    });
    
    console.log('Cleared existing commission record');
    
    // Recalculate with new naming convention
    const result = await enhancedCommissionCalculator.calculateDealCommission(deal.id, {
      createAuditRecord: true,
      useAdvancedRules: true
    });
    
    if (result.commission) {
      console.log('\n✅ Commission created with new naming:');
      console.log({
        id: result.commission.id,
        deal: deal.deal_name,
        target_name: result.commission.target_name,
        target_id: result.commission.target_id,
        amount: result.commission.commission_amount,
        status: result.commission.status
      });
    } else {
      console.log('No commission created');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTargetNaming();