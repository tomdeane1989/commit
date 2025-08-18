import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkJoelDeal() {
  // Find Joel
  const joel = await prisma.users.findFirst({
    where: { first_name: 'Joel', last_name: 'Savilahti' }
  });
  
  if (!joel) {
    console.log('Joel not found');
    return;
  }
  
  console.log('Found Joel:', joel.email);
  
  // Get Joel's most recent closed won deal
  const recentDeal = await prisma.deals.findFirst({
    where: {
      user_id: joel.id,
      stage: { in: ['Closed Won', 'closed_won'] }
    },
    orderBy: { close_date: 'desc' },
    take: 1
  });
  
  if (recentDeal) {
    console.log('\nJoel\'s most recent closed won deal:', {
      name: recentDeal.deal_name,
      amount: recentDeal.amount,
      close_date: recentDeal.close_date,
      commission_amount: recentDeal.commission_amount,
      commission_rate: recentDeal.commission_rate,
      calculated_at: recentDeal.commission_calculated_at
    });
    
    // Expected vs actual
    const expectedCommission = recentDeal.amount * 0.10;
    console.log('\n💰 Commission Analysis:');
    console.log(`  Deal Amount: £${recentDeal.amount}`);
    console.log(`  Expected (10%): £${expectedCommission.toFixed(2)}`);
    console.log(`  Actual: £${recentDeal.commission_amount?.toFixed(2)} (${(recentDeal.commission_rate * 100).toFixed(1)}%)`);
    
    // Check commission record
    const commission = await prisma.commissions.findUnique({
      where: { deal_id: recentDeal.id }
    });
    
    if (commission) {
      console.log('\n📋 Commission record:', {
        id: commission.id,
        commission_amount: commission.commission_amount,
        commission_rate: commission.commission_rate,
        target_name: commission.target_name,
        target_id: commission.target_id,
        status: commission.status
      });
    } else {
      console.log('\n⚠️ No commission record found');
    }
    
    // Check Joel's active target
    const activeTarget = await prisma.targets.findFirst({
      where: {
        user_id: joel.id,
        is_active: true,
        period_start: { lte: recentDeal.close_date },
        period_end: { gte: recentDeal.close_date }
      },
      orderBy: [
        { parent_target_id: 'desc' },
        { created_at: 'desc' }
      ]
    });
    
    if (activeTarget) {
      console.log('\n🎯 Active target for deal close date:', {
        id: activeTarget.id,
        period_type: activeTarget.period_type,
        commission_rate: activeTarget.commission_rate,
        period: `${activeTarget.period_start.toISOString().split('T')[0]} to ${activeTarget.period_end.toISOString().split('T')[0]}`
      });
    } else {
      console.log('\n⚠️ No active target found for deal close date');
    }
  } else {
    console.log('No closed won deals found for Joel');
  }
  
  await prisma.$disconnect();
}

checkJoelDeal().catch(console.error);