import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

// Use production database URL
const productionUrl = process.env.PRODUCTION_DATABASE_URL;

if (!productionUrl) {
  console.error('❌ PRODUCTION_DATABASE_URL not found in .env file');
  process.exit(1);
}

console.log('🔌 Connecting to PRODUCTION database...');
console.log('Database URL:', productionUrl.replace(/:[^:@]+@/, ':****@'));

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: productionUrl
    }
  }
});

async function checkProductionTargets() {
  try {
    console.log('\n🔍 Checking PRODUCTION database for orphaned targets...\n');

    // First, let's verify we're connected to production
    const userCount = await prisma.users.count();
    console.log(`Users in database: ${userCount} (if this is low, we might be on local DB)\n`);

    // Get all targets
    const allTargets = await prisma.targets.findMany({
      include: {
        user: true
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    console.log(`Total targets in PRODUCTION: ${allTargets.length}`);

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
    console.log(`Child targets (distributed): ${childTargets.length}`);

    // Check for orphaned child targets
    const orphanedTargets = [];
    
    for (const child of childTargets) {
      const parentId = child.distribution_config.parent_id;
      const parentExists = allTargets.some(t => t.id === parentId);
      
      if (!parentExists) {
        orphanedTargets.push(child);
      }
    }

    console.log(`\n⚠️  ORPHANED targets found: ${orphanedTargets.length}`);

    if (orphanedTargets.length > 0) {
      console.log('\n🚨 ORPHANED TARGET DETAILS:');
      console.log('These are child targets whose parent has been deleted:');
      orphanedTargets.forEach(target => {
        console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ID: ${target.id}
User: ${target.user?.email || target.user_id}
Period: ${target.period_type}
Amount: £${target.quota_amount}
Period: ${new Date(target.period_start).toLocaleDateString()} - ${new Date(target.period_end).toLocaleDateString()}
Parent ID: ${target.distribution_config.parent_id} (DELETED)
Active: ${target.is_active}
Created: ${new Date(target.created_at).toLocaleDateString()}
        `);
      });
    }

    // Look specifically for Alfie's targets
    console.log('\n\n🔍 ALFIE\'S TARGETS:');
    const alfieTargets = allTargets.filter(t => 
      t.user?.email === 'alfie@test.com' || 
      (t.user?.first_name === 'Alfie' && t.user?.last_name === 'Ferris')
    );
    
    console.log(`Found ${alfieTargets.length} targets for Alfie:`);
    alfieTargets.forEach(target => {
      const isOrphaned = orphanedTargets.some(o => o.id === target.id);
      const status = isOrphaned ? '⚠️ ORPHANED' : target.is_active ? '✓ ACTIVE' : '❌ INACTIVE';
      const parentInfo = target.distribution_config?.parent_id 
        ? `(child of ${target.distribution_config.parent_id})`
        : '(parent target)';
      
      console.log(`
${status} ${target.period_type.toUpperCase()}: £${target.quota_amount} ${parentInfo}
   ID: ${target.id}
   Period: ${new Date(target.period_start).toLocaleDateString()} - ${new Date(target.period_end).toLocaleDateString()}
   Created: ${new Date(target.created_at).toLocaleDateString()}
      `);
    });

    // Show all active targets with orphan status
    console.log('\n\n📊 ALL ACTIVE TARGETS (with orphan status):');
    const activeTargets = allTargets.filter(t => t.is_active);
    
    const targetsByUser = {};
    activeTargets.forEach(target => {
      const email = target.user?.email || 'Unknown';
      if (!targetsByUser[email]) targetsByUser[email] = [];
      targetsByUser[email].push(target);
    });

    Object.entries(targetsByUser).forEach(([email, targets]) => {
      console.log(`\n${email}:`);
      targets.forEach(t => {
        const isOrphaned = orphanedTargets.some(o => o.id === t.id);
        const status = isOrphaned ? '⚠️ ORPHANED' : '✓';
        const parent = t.distribution_config?.parent_id 
          ? `(child of ${t.distribution_config.parent_id})` 
          : '(parent)';
        console.log(`  ${status} ${t.period_type}: £${t.quota_amount} ${parent}`);
      });
    });

  } catch (error) {
    console.error('❌ Error checking production targets:', error);
    console.error('Make sure PRODUCTION_DATABASE_URL is set in your .env file');
  } finally {
    await prisma.$disconnect();
  }
}

checkProductionTargets();