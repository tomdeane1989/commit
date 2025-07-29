// Test script to debug target creation
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://commit_db_qidw_user:HULsCzXABO7dyM358TksMWJitQF8VbeO@dpg-d20dg07fte5s738pdd60-a.oregon-postgres.render.com/commit_db_qidw'
    }
  }
});

async function testTargetCreation() {
  try {
    console.log('Testing target creation...');
    
    // Test basic target creation with minimum required fields
    const testTarget = await prisma.targets.create({
      data: {
        user_id: 'cmdg6hk7f001hsfe420rqy5hd',
        company_id: 'cmdfyi4zl001lk5sieje7k0nv',
        period_type: 'annual',
        period_start: new Date('2025-01-01'),
        period_end: new Date('2025-12-31'),
        quota_amount: 100000,
        commission_rate: 0.1,
        commission_payment_schedule: 'monthly',
        is_active: true,
        role: null,
        // Test new fields
        distribution_method: 'even',
        distribution_config: null,
        parent_target_id: null,
        team_target: false
      }
    });
    
    console.log('✅ Target created successfully:', testTarget.id);
    
    // Clean up - delete the test target
    await prisma.targets.delete({
      where: { id: testTarget.id }
    });
    
    console.log('✅ Test target cleaned up');
    
  } catch (error) {
    console.error('❌ Error creating target:', error);
    console.error('Error details:', error.message);
    console.error('Error code:', error.code);
  } finally {
    await prisma.$disconnect();
  }
}

testTargetCreation();