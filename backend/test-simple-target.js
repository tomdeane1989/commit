// Simple test to isolate the issue
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://commit_db_qidw_user:HULsCzXABO7dyM358TksMWJitQF8VbeO@dpg-d20dg07fte5s738pdd60-a.oregon-postgres.render.com/commit_db_qidw'
    }
  }
});

async function testBasicLogic() {
  try {
    console.log('Testing basic target creation logic...');
    
    // Test 1: Check if user exists
    const user = await prisma.users.findUnique({
      where: { 
        id: 'cmdg6hk7f001hsfe420rqy5hd',
        company_id: 'cmdfyi4zl001lk5sieje7k0nv'
      }
    });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('✅ User found:', user.email);
    
    // Test 2: Check for overlapping targets
    const overlapping = await prisma.targets.findFirst({
      where: {
        user_id: user.id,
        is_active: true,
        OR: [
          {
            period_start: { lte: new Date('2025-12-31') },
            period_end: { gte: new Date('2025-01-01') }
          }
        ]
      }
    });
    
    if (overlapping) {
      console.log('📋 Found overlapping target:', overlapping.id);
      
      // Deactivate overlapping
      await prisma.targets.updateMany({
        where: {
          user_id: user.id,
          is_active: true,
          AND: [
            { period_start: { lte: new Date('2025-12-31') } },
            { period_end: { gte: new Date('2025-01-01') } }
          ]
        },
        data: {
          is_active: false
        }
      });
      console.log('✅ Deactivated overlapping targets');
    }
    
    // Test 3: Create target with minimal fields
    const target = await prisma.targets.create({
      data: {
        user_id: user.id,
        company_id: 'cmdfyi4zl001lk5sieje7k0nv',
        period_type: 'annual',
        period_start: new Date('2025-01-01'),
        period_end: new Date('2025-12-31'),
        quota_amount: 100000,
        commission_rate: 0.1,
        commission_payment_schedule: 'monthly',
        is_active: true,
        role: null,
        distribution_method: 'even',
        distribution_config: null,
        parent_target_id: null,
        team_target: false
      }
    });
    
    console.log('✅ Target created successfully:', target.id);
    
    // Clean up
    await prisma.targets.delete({
      where: { id: target.id }
    });
    
    console.log('✅ Cleaned up test target');
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testBasicLogic();