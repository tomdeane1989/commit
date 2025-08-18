import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkAlfiesDeal() {
  // Find Alfie's user record
  const alfie = await prisma.users.findFirst({
    where: { 
      first_name: 'Alfie',
      last_name: 'Ferris'
    }
  });
  
  if (!alfie) {
    console.log('Alfie not found');
    return;
  }
  
  console.log('Found Alfie:', alfie.email);
  
  // Find the Organic Upsell deal
  const deal = await prisma.deals.findFirst({
    where: {
      user_id: alfie.id,
      deal_name: { contains: 'Organic Upsell' }
    }
  });
  
  if (deal) {
    console.log('\nFound deal:', {
      id: deal.id,
      name: deal.deal_name,
      amount: deal.amount,
      stage: deal.stage,
      close_date: deal.close_date,
      commission_amount: deal.commission_amount,
      commission_rate: deal.commission_rate
    });
    
    // Check if commission record exists
    const commission = await prisma.commissions.findUnique({
      where: { deal_id: deal.id }
    });
    
    if (commission) {
      console.log('\nCommission record exists:', {
        id: commission.id,
        status: commission.status,
        amount: commission.commission_amount
      });
    } else {
      console.log('\n⚠️ No commission record found in commissions table');
      console.log('Creating commission record now...');
      
      // Import the enhanced calculator
      const { default: enhancedCommissionCalculator } = await import('./services/enhancedCommissionCalculator.js');
      
      // Calculate and create commission record
      const result = await enhancedCommissionCalculator.calculateDealCommission(deal.id, {
        createAuditRecord: true,
        useAdvancedRules: true
      });
      
      console.log('✅ Commission record created:', {
        commission_id: result.commission?.id,
        status: result.commission?.status,
        amount: result.commission?.commission_amount
      });
    }
  } else {
    console.log('Deal not found');
  }
  
  await prisma.$disconnect();
}

checkAlfiesDeal().catch(console.error);