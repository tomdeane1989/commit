import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function checkOrphanedTargets() {
  try {
    console.log('🔍 Checking for orphaned targets...\n');

    // Get all targets
    const allTargets = await prisma.targets.findMany({
      include: {
        user: true
      }
    });

    console.log(`Total targets in database: ${allTargets.length}`);

    // Separate parent and child targets
    const parentTargets = allTargets.filter(t => 
      !t.distribution_config || 
      !t.distribution_config.parent_id
    );
    
    const childTargets = allTargets.filter(t => 
      t.distribution_config && 
      t.distribution_config.parent_id
    );

    console.log(`Parent targets: ${parentTargets.length}`);
    console.log(`Child targets: ${childTargets.length}`);

    // Check for orphaned child targets
    const orphanedTargets = [];
    
    for (const child of childTargets) {
      const parentId = child.distribution_config.parent_id;
      const parentExists = allTargets.some(t => t.id === parentId);
      
      if (!parentExists) {
        orphanedTargets.push(child);
      }
    }

    console.log(`\n⚠️  Orphaned targets found: ${orphanedTargets.length}`);

    if (orphanedTargets.length > 0) {
      console.log('\nOrphaned target details:');
      orphanedTargets.forEach(target => {
        console.log(`
ID: ${target.id}
User: ${target.user?.email || target.user_id}
Period: ${target.period_type}
Amount: £${target.quota_amount}
Period: ${new Date(target.period_start).toLocaleDateString()} - ${new Date(target.period_end).toLocaleDateString()}
Parent ID: ${target.distribution_config.parent_id} (MISSING)
Active: ${target.is_active}
        `);
      });

      // Group by user to see impact
      const userImpact = {};
      orphanedTargets.forEach(target => {
        const email = target.user?.email || 'Unknown';
        if (!userImpact[email]) {
          userImpact[email] = [];
        }
        userImpact[email].push({
          period: target.period_type,
          amount: target.quota_amount
        });
      });

      console.log('\n📊 Impact by user:');
      Object.entries(userImpact).forEach(([email, targets]) => {
        console.log(`\n${email}:`);
        targets.forEach(t => {
          console.log(`  - ${t.period}: £${t.amount}`);
        });
      });
    }

    // Check for active targets by user
    console.log('\n\n📋 Current active targets by user:');
    const activeTargetsByUser = {};
    
    allTargets
      .filter(t => t.is_active)
      .forEach(target => {
        const email = target.user?.email || 'Unknown';
        if (!activeTargetsByUser[email]) {
          activeTargetsByUser[email] = [];
        }
        activeTargetsByUser[email].push({
          id: target.id,
          period: target.period_type,
          amount: target.quota_amount,
          isOrphaned: orphanedTargets.some(o => o.id === target.id),
          hasParent: target.distribution_config?.parent_id || null
        });
      });

    Object.entries(activeTargetsByUser).forEach(([email, targets]) => {
      console.log(`\n${email}:`);
      targets.forEach(t => {
        const status = t.isOrphaned ? '⚠️ ORPHANED' : '✓';
        const parent = t.hasParent ? `(child of ${t.hasParent})` : '(parent)';
        console.log(`  ${status} ${t.period}: £${t.amount} ${parent}`);
      });
    });

  } catch (error) {
    console.error('❌ Error checking targets:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrphanedTargets();