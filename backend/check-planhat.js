import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkPlanhatDeal() {
  // Find the Planhat deal
  const planhatDeal = await prisma.deals.findFirst({
    where: { 
      OR: [
        { deal_name: { contains: 'Planhat' } },
        { account_name: { contains: 'Planhat' } }
      ]
    },
    orderBy: { created_at: 'desc' },
    include: {
      user: { select: { id: true, first_name: true, last_name: true } }
    }
  });
  
  if (!planhatDeal) {
    console.log('No Planhat deal found');
    return;
  }
  
  console.log('Planhat deal:', {
    id: planhatDeal.id,
    name: planhatDeal.deal_name,
    account: planhatDeal.account_name,
    user: planhatDeal.user.first_name + ' ' + planhatDeal.user.last_name,
    user_id: planhatDeal.user.id,
    amount: planhatDeal.amount,
    commission_rate: planhatDeal.commission_rate,
    commission_amount: planhatDeal.commission_amount,
    close_date: planhatDeal.close_date,
    stage: planhatDeal.stage,
    created_at: planhatDeal.created_at
  });
  
  // Check the user's target
  const target = await prisma.targets.findFirst({
    where: {
      user_id: planhatDeal.user_id,
      is_active: true,
      period_start: { lte: planhatDeal.close_date },
      period_end: { gte: planhatDeal.close_date }
    }
  });
  
  if (target) {
    console.log('\nUser has active target:', {
      id: target.id,
      commission_rate: target.commission_rate,
      period_type: target.period_type,
      period: target.period_start + ' to ' + target.period_end
    });
  } else {
    console.log('\nNO ACTIVE TARGET FOUND for this user on close date:', planhatDeal.close_date);
    
    // Check all targets for this user
    const allTargets = await prisma.targets.findMany({
      where: { user_id: planhatDeal.user_id }
    });
    
    console.log('\nAll targets for this user:');
    allTargets.forEach(t => {
      console.log({
        id: t.id,
        period: t.period_start + ' to ' + t.period_end,
        is_active: t.is_active,
        commission_rate: t.commission_rate
      });
    });
  }
  
  // Check commission record
  const commission = await prisma.commissions.findUnique({
    where: { deal_id: planhatDeal.id }
  });
  
  if (commission) {
    console.log('\nCommission record:', {
      id: commission.id,
      rate: commission.commission_rate,
      amount: commission.commission_amount,
      target_name: commission.target_name,
      target_id: commission.target_id
    });
  } else {
    console.log('\nNo commission record found');
  }
  
  await prisma.$disconnect();
}

checkPlanhatDeal().catch(console.error);