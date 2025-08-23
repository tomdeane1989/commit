import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkTargets() {
  const targets = await prisma.targets.findMany({
    where: { is_active: true },
    select: {
      id: true,
      user: { select: { first_name: true, last_name: true } },
      period_type: true,
      period_start: true,
      period_end: true,
      parent_target_id: true,
      quota_amount: true,
      commission_rate: true
    }
  });
  
  console.log('Current active targets:\n');
  targets.forEach(t => {
    const start = new Date(t.period_start).toISOString().split('T')[0];
    const end = new Date(t.period_end).toISOString().split('T')[0];
    console.log({
      id: t.id.substring(0, 8) + '...',
      user: `${t.user.first_name} ${t.user.last_name}`,
      period_type: t.period_type,
      period: `${start} to ${end}`,
      is_child: !!t.parent_target_id,
      quota: t.quota_amount,
      rate: (t.commission_rate * 100) + '%'
    });
  });
  
  // Check commission records to see what target_name is stored
  console.log('\n\nTarget names in commission records:');
  const commissions = await prisma.commissions.findMany({
    select: {
      target_name: true,
      target_id: true,
      deal: { select: { deal_name: true } }
    },
    take: 5
  });
  
  commissions.forEach(c => {
    console.log({
      deal: c.deal.deal_name,
      target_name: c.target_name,
      target_id: c.target_id?.substring(0, 8) + '...'
    });
  });
  
  await prisma.$disconnect();
}

checkTargets().catch(console.error);