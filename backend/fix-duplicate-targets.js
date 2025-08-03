import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixDuplicateTargets() {
  console.log('🔧 FIXING DUPLICATE ACTIVE TARGETS');
  console.log('='.repeat(50));
  
  try {
    // Find users with multiple active targets
    const users = await prisma.users.findMany({
      include: {
        targets: {
          where: { is_active: true },
          orderBy: { created_at: 'desc' }
        }
      }
    });
    
    let fixedCount = 0;
    
    for (const user of users) {
      if (user.targets.length > 1) {
        console.log(`🔍 ${user.first_name} ${user.last_name} has ${user.targets.length} active targets`);
        
        // Keep the most recent target, deactivate others
        const mostRecentTarget = user.targets[0];
        const oldTargets = user.targets.slice(1);
        
        console.log(`   ✅ Keeping: ${mostRecentTarget.period_type} £${mostRecentTarget.quota_amount} (${mostRecentTarget.created_at})`);
        
        for (const oldTarget of oldTargets) {
          console.log(`   ❌ Deactivating: ${oldTarget.period_type} £${oldTarget.quota_amount} (${oldTarget.created_at})`);
          
          await prisma.targets.update({
            where: { id: oldTarget.id },
            data: { is_active: false }
          });
          
          fixedCount++;
        }
        
        console.log();
      }
    }
    
    console.log(`🎯 Fixed ${fixedCount} duplicate active targets`);
    
    // Verify fix
    const remainingDuplicates = await prisma.users.findMany({
      include: {
        targets: {
          where: { is_active: true }
        }
      }
    });
    
    const stillHaveDuplicates = remainingDuplicates.filter(user => user.targets.length > 1);
    
    if (stillHaveDuplicates.length === 0) {
      console.log('✅ All duplicate targets fixed successfully!');
    } else {
      console.log(`⚠️  ${stillHaveDuplicates.length} users still have multiple active targets`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing duplicate targets:', error);
  }
  
  await prisma.$disconnect();
}

fixDuplicateTargets().catch(console.error);