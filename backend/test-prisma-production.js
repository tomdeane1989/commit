// Test if Prisma client in production has the new fields
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://commit_db_qidw_user:HULsCzXABO7dyM358TksMWJitQF8VbeO@dpg-d20dg07fte5s738pdd60-a.oregon-postgres.render.com/commit_db_qidw'
    }
  }
});

async function testPrismaFields() {
  try {
    console.log('Testing if Prisma client recognizes new fields...');
    
    // This should work if the Prisma client has been regenerated
    const testTarget = {
      user_id: 'cmdg6hk7f001hsfe420rqy5hd',
      company_id: 'cmdfyi4zl001lk5sieje7k0nv',
      period_type: 'annual',
      period_start: new Date('2025-01-01'),
      period_end: new Date('2025-12-31'),
      quota_amount: 50000,
      commission_rate: 0.1,
      commission_payment_schedule: 'monthly',
      is_active: true,
      role: null,
      // These are the new fields that should now be recognized
      distribution_method: 'seasonal',
      distribution_config: {
        seasonal: {
          seasonal_granularity: 'quarterly',
          seasonal_allocation_method: 'percentage',
          seasonal_allocations: { Q1: 25, Q2: 30, Q3: 15, Q4: 30 }
        },
        original_quota: 50000
      },
      parent_target_id: null,
      team_target: false
    };
    
    const target = await prisma.targets.create({
      data: testTarget
    });
    
    console.log('✅ SUCCESS: Prisma client recognizes new fields!');
    console.log('Created target with ID:', target.id);
    
    // Clean up
    await prisma.targets.delete({ where: { id: target.id } });
    console.log('✅ Test target cleaned up');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.message.includes('Unknown argument')) {
      console.error('❌ Prisma client still needs to be regenerated');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testPrismaFields();