import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupChildTargets() {
  try {
    console.log('🧹 Starting cleanup of orphaned child targets...\n');

    // First, find Tom's user ID
    const tom = await prisma.users.findFirst({
      where: { email: 'tom@test.com' }
    });

    if (!tom) {
      console.log('❌ Could not find tom@test.com');
      return;
    }

    console.log(`✅ Found Tom: ${tom.id}\n`);

    // Find Tom's team members
    const teamMembers = await prisma.users.findMany({
      where: {
        manager_id: tom.id,
        company_id: tom.company_id
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true
      }
    });

    console.log(`📋 Found ${teamMembers.length} team members:`);
    teamMembers.forEach(member => {
      console.log(`   - ${member.first_name} ${member.last_name} (${member.email})`);
    });
    console.log('');

    // Add Tom to the list for complete cleanup
    const allUsers = [...teamMembers, tom];

    // Find all targets that have no active parent
    for (const user of allUsers) {
      console.log(`\n🔍 Checking targets for ${user.email}:`);

      // Find all targets for this user
      const allTargets = await prisma.targets.findMany({
        where: {
          user_id: user.id,
          is_active: true
        },
        select: {
          id: true,
          period_type: true,
          period_start: true,
          period_end: true,
          quota_amount: true,
          parent_target_id: true,
          is_active: true
        }
      });

      console.log(`   Found ${allTargets.length} active targets`);

      // Check each target to see if it's an orphaned child
      const orphanedTargets = [];
      
      for (const target of allTargets) {
        if (target.parent_target_id) {
          // This is a child target - check if parent exists and is active
          const parent = await prisma.targets.findUnique({
            where: { id: target.parent_target_id }
          });

          if (!parent || !parent.is_active) {
            orphanedTargets.push(target);
            console.log(`   ⚠️  Orphaned child target found:`);
            console.log(`      - Type: ${target.period_type}`);
            console.log(`      - Period: ${target.period_start.toISOString().split('T')[0]} to ${target.period_end.toISOString().split('T')[0]}`);
            console.log(`      - Quota: £${target.quota_amount}`);
            console.log(`      - Parent: ${parent ? 'INACTIVE' : 'MISSING'}`);
          }
        }
      }

      // Deactivate orphaned targets
      if (orphanedTargets.length > 0) {
        const result = await prisma.targets.updateMany({
          where: {
            id: { in: orphanedTargets.map(t => t.id) }
          },
          data: {
            is_active: false
          }
        });
        console.log(`   ✅ Deactivated ${result.count} orphaned child targets`);
      } else {
        console.log(`   ✅ No orphaned targets found`);
      }
    }

    console.log('\n✨ Cleanup complete!');
    
    // Show summary of remaining active targets
    console.log('\n📊 Summary of remaining active targets:');
    for (const user of allUsers) {
      const activeTargets = await prisma.targets.findMany({
        where: {
          user_id: user.id,
          is_active: true
        },
        select: {
          period_type: true,
          quota_amount: true
        }
      });
      
      if (activeTargets.length > 0) {
        console.log(`\n${user.email}:`);
        activeTargets.forEach(target => {
          console.log(`   - ${target.period_type}: £${target.quota_amount}`);
        });
      } else {
        console.log(`\n${user.email}: No active targets`);
      }
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupChildTargets();