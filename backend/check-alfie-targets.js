import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.PRODUCTION_DATABASE_URL
    }
  }
});

async function checkAlfieTargets() {
  try {
    console.log('🔍 Checking Alfie\'s targets in PRODUCTION...\n');

    // Find Alfie
    const alfie = await prisma.users.findFirst({
      where: {
        OR: [
          { email: 'alfie@test.com' },
          { 
            AND: [
              { first_name: 'Alfie' },
              { last_name: 'Ferris' }
            ]
          }
        ]
      }
    });

    if (!alfie) {
      console.log('❌ Alfie not found in database');
      return;
    }

    console.log(`Found Alfie: ${alfie.email} (ID: ${alfie.id})\n`);

    // Get ALL of Alfie's targets (active and inactive)
    const alfieTargets = await prisma.targets.findMany({
      where: {
        user_id: alfie.id
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    console.log(`Total targets for Alfie: ${alfieTargets.length}\n`);

    // Group by status
    const activeTargets = alfieTargets.filter(t => t.is_active);
    const inactiveTargets = alfieTargets.filter(t => !t.is_active);

    console.log('ACTIVE TARGETS:', activeTargets.length);
    activeTargets.forEach(target => {
      console.log(`
✓ ${target.period_type.toUpperCase()}: £${target.quota_amount}
  ID: ${target.id}
  Period: ${new Date(target.period_start).toLocaleDateString()} - ${new Date(target.period_end).toLocaleDateString()}
  Parent: ${target.distribution_config?.parent_id || 'N/A (parent target)'}
  Created: ${new Date(target.created_at).toISOString()}
`);
    });

    console.log('\nINACTIVE TARGETS:', inactiveTargets.length);
    inactiveTargets.forEach(target => {
      console.log(`
❌ ${target.period_type.toUpperCase()}: £${target.quota_amount}
  ID: ${target.id}
  Period: ${new Date(target.period_start).toLocaleDateString()} - ${new Date(target.period_end).toLocaleDateString()}
  Parent: ${target.distribution_config?.parent_id || 'N/A (parent target)'}
  Created: ${new Date(target.created_at).toISOString()}
`);
    });

    // Check for current period targets
    const now = new Date();
    console.log('\n📅 CURRENT PERIOD TARGETS (overlapping with today):');
    
    const currentTargets = alfieTargets.filter(t => {
      const start = new Date(t.period_start);
      const end = new Date(t.period_end);
      return start <= now && end >= now;
    });

    if (currentTargets.length === 0) {
      console.log('No targets found for current period');
    } else {
      currentTargets.forEach(target => {
        const status = target.is_active ? '✓ ACTIVE' : '❌ INACTIVE';
        console.log(`
${status} ${target.period_type.toUpperCase()}: £${target.quota_amount}
  Period: ${new Date(target.period_start).toLocaleDateString()} - ${new Date(target.period_end).toLocaleDateString()}
`);
      });
    }

    // Check what the team endpoint might be returning
    console.log('\n🔍 What the /team-members endpoint might see:');
    console.log('(This simulates the target selection logic)');
    
    const activeCurrentTargets = alfieTargets.filter(t => {
      const start = new Date(t.period_start);
      const end = new Date(t.period_end);
      return t.is_active && start <= now && end >= now;
    });

    // Separate by type
    const childTargets = activeCurrentTargets.filter(t => t.distribution_config?.parent_id);
    const parentTargets = activeCurrentTargets.filter(t => !t.distribution_config?.parent_id);

    console.log(`\nChild targets (quarterly): ${childTargets.length}`);
    childTargets.forEach(t => {
      console.log(`  - ${t.period_type}: £${t.quota_amount}`);
    });

    console.log(`\nParent targets (annual): ${parentTargets.length}`);
    parentTargets.forEach(t => {
      console.log(`  - ${t.period_type}: £${t.quota_amount}`);
    });

    const selectedTarget = childTargets.length > 0 ? childTargets[0] : parentTargets[0];
    if (selectedTarget) {
      console.log(`\n➡️  SELECTED TARGET: ${selectedTarget.period_type} - £${selectedTarget.quota_amount}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAlfieTargets();