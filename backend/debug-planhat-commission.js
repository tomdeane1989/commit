import { PrismaClient } from '@prisma/client';
import enhancedCommissionCalculator from './services/enhancedCommissionCalculator.js';

const prisma = new PrismaClient();

async function debugPlanhatCommission() {
  try {
    // Get the Planhat deal
    const planhatDeal = await prisma.deals.findFirst({
      where: { account_name: 'Planhat' },
      orderBy: { created_at: 'desc' }
    });
    
    if (!planhatDeal) {
      console.log('No Planhat deal found');
      return;
    }
    
    console.log('Found Planhat deal:', {
      id: planhatDeal.id,
      name: planhatDeal.deal_name,
      amount: planhatDeal.amount,
      current_commission_rate: planhatDeal.commission_rate,
      current_commission_amount: planhatDeal.commission_amount
    });
    
    // Delete existing commission record to force recalculation
    await prisma.commission_approvals.deleteMany({
      where: {
        commission: { deal_id: planhatDeal.id }
      }
    });
    await prisma.commissions.deleteMany({
      where: { deal_id: planhatDeal.id }
    });
    
    console.log('\n🔄 Recalculating commission with enhanced calculator...');
    
    // Call with debug logging
    const result = await enhancedCommissionCalculator.calculateDealCommission(planhatDeal.id, {
      createAuditRecord: true,
      useAdvancedRules: false,
      recalculate: true
    });
    
    console.log('\n📊 Result from calculator:', {
      deal_commission_rate: result.deal?.commission_rate,
      deal_commission_amount: result.deal?.commission_amount,
      commission_record: result.commission ? {
        rate: result.commission.commission_rate,
        amount: result.commission.commission_amount,
        target_name: result.commission.target_name
      } : null
    });
    
    // Check the deal in DB again
    const updatedDeal = await prisma.deals.findUnique({
      where: { id: planhatDeal.id }
    });
    
    console.log('\n✅ Final deal in database:', {
      commission_rate: updatedDeal.commission_rate,
      commission_amount: updatedDeal.commission_amount
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPlanhatCommission();