// Script to clean up redundant team target aggregation records
// This will remove aggregated team targets (like Tom's £720k target)
// and update the team_target field to false for all remaining targets

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupTeamTargets() {
  console.log('🧹 Starting team targets cleanup...');
  
  try {
    // 1. First, identify managers who have both individual and team targets
    const managersWithDuplicates = await prisma.$queryRaw`
      SELECT DISTINCT t1.user_id, u.email, u.first_name, u.last_name
      FROM targets t1
      JOIN targets t2 ON t1.user_id = t2.user_id
      JOIN users u ON t1.user_id = u.id
      WHERE t1.team_target = false 
      AND t2.team_target = true
      AND t1.is_active = true 
      AND t2.is_active = true
    `;
    
    console.log(`📊 Found ${managersWithDuplicates.length} managers with duplicate targets`);
    
    // 2. Delete the aggregated team targets for these managers
    let deletedCount = 0;
    for (const manager of managersWithDuplicates) {
      console.log(`\n👤 Processing ${manager.first_name} ${manager.last_name} (${manager.email})`);
      
      // Find all targets for this user
      const userTargets = await prisma.targets.findMany({
        where: {
          user_id: manager.user_id,
          is_active: true
        },
        orderBy: {
          quota_amount: 'desc'
        }
      });
      
      console.log(`  - Found ${userTargets.length} active targets`);
      
      // Delete team targets that appear to be aggregations
      for (const target of userTargets.filter(t => t.team_target)) {
        console.log(`  - Deleting team target: £${target.quota_amount} (${target.period_type})`);
        
        await prisma.targets.update({
          where: { id: target.id },
          data: { is_active: false }
        });
        
        deletedCount++;
      }
    }
    
    console.log(`\n✅ Deactivated ${deletedCount} aggregated team targets`);
    
    // 3. Update all remaining active targets to have team_target = false
    const updateResult = await prisma.targets.updateMany({
      where: {
        is_active: true,
        team_target: true
      },
      data: {
        team_target: false
      }
    });
    
    console.log(`\n✅ Updated ${updateResult.count} targets to team_target = false`);
    
    // 4. Show final state
    const finalTargets = await prisma.targets.findMany({
      where: { is_active: true },
      include: {
        user: {
          select: {
            email: true,
            first_name: true,
            last_name: true
          }
        }
      }
    });
    
    console.log('\n📊 Final active targets:');
    for (const target of finalTargets) {
      console.log(`  - ${target.user.first_name} ${target.user.last_name}: £${target.quota_amount} (team_target: ${target.team_target})`);
    }
    
    console.log('\n✅ Team targets cleanup completed!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupTeamTargets();