import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkQuotaAmounts() {
  console.log('🔍 Checking quota amounts in commission records...');
  
  // Get recent commission records with user and target info
  const commissions = await prisma.commissions.findMany({
    where: {
      period_start: { gte: new Date('2025-06-01') }
    },
    include: {
      user: { select: { first_name: true, last_name: true, email: true } },
      target: { 
        select: { 
          quota_amount: true, 
          period_type: true, 
          commission_payment_schedule: true,
          period_start: true,
          period_end: true
        } 
      }
    },
    orderBy: [
      { period_start: 'desc' },
      { user: { email: 'asc' } }
    ]
  });
  
  console.log(`Found ${commissions.length} recent commission records:\n`);
  
  commissions.forEach(c => {
    const period = c.period_start.toISOString().split('T')[0];
    const attainment = c.quota_amount > 0 ? (c.actual_amount / c.quota_amount * 100).toFixed(1) : '0.0';
    
    console.log(`📅 ${period} - ${c.user.first_name} ${c.user.last_name}:`);
    console.log(`   Commission quota_amount: £${c.quota_amount}`);
    console.log(`   Target quota_amount: £${c.target.quota_amount}`);
    console.log(`   Target type: ${c.target.period_type}`);
    console.log(`   Payment schedule: ${c.target.commission_payment_schedule}`);
    console.log(`   Actual sales: £${c.actual_amount}`);
    console.log(`   Calculated attainment: ${attainment}%`);
    console.log(`   Stored attainment: ${c.attainment_pct}%`);
    console.log('');
  });
  
  // Check for inconsistencies
  console.log('🔍 Checking for quota calculation issues...');
  
  const issues = commissions.filter(c => {
    const target = c.target;
    let expectedQuota = Number(target.quota_amount);
    
    // Calculate expected prorated quota
    if (target.period_type === 'annual' && target.commission_payment_schedule === 'monthly') {
      expectedQuota = Number(target.quota_amount) / 12;
    } else if (target.period_type === 'annual' && target.commission_payment_schedule === 'quarterly') {
      expectedQuota = Number(target.quota_amount) / 4;
    }
    
    // Check if stored quota matches expected
    return Math.abs(Number(c.quota_amount) - expectedQuota) > 1;
  });
  
  if (issues.length > 0) {
    console.log(`⚠️  Found ${issues.length} quota calculation issues:`);
    issues.forEach(c => {
      const target = c.target;
      let expectedQuota = Number(target.quota_amount);
      
      if (target.period_type === 'annual' && target.commission_payment_schedule === 'monthly') {
        expectedQuota = Number(target.quota_amount) / 12;
      } else if (target.period_type === 'annual' && target.commission_payment_schedule === 'quarterly') {
        expectedQuota = Number(target.quota_amount) / 4;
      }
      
      console.log(`   ${c.user.first_name} ${c.user.last_name}: Expected £${expectedQuota}, Got £${c.quota_amount}`);
    });
  } else {
    console.log('✅ All quota calculations appear correct');
  }
  
  await prisma.$disconnect();
}

checkQuotaAmounts().catch(console.error);