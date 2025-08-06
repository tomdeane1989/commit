// migrate-to-flag-based-permissions.js
// Migrates from string-based roles to boolean flags
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateToFlagBasedPermissions() {
  console.log('🔄 Starting migration to flag-based permissions...\n');
  
  try {
    // Step 1: Get all users
    const allUsers = await prisma.users.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        is_admin: true,
        is_manager: true,
        is_active: true,
        company: {
          select: { name: true }
        }
      },
      orderBy: [
        { company_id: 'asc' },
        { email: 'asc' }
      ]
    });

    console.log(`📊 Found ${allUsers.length} users to process\n`);

    // Step 2: Analyze current state
    const stats = {
      total: allUsers.length,
      byRole: {},
      flagMismatches: [],
      updated: 0
    };

    allUsers.forEach(user => {
      if (!stats.byRole[user.role]) {
        stats.byRole[user.role] = 0;
      }
      stats.byRole[user.role]++;
    });

    console.log('📈 Current role distribution:');
    Object.entries(stats.byRole).forEach(([role, count]) => {
      console.log(`   ${role}: ${count} users`);
    });
    console.log('');

    // Step 3: Update users based on their role
    console.log('🔧 Updating user flags based on roles...\n');

    for (const user of allUsers) {
      let updates = {};
      let shouldUpdate = false;

      // Determine what the flags should be based on role
      switch (user.role) {
        case 'admin':
          // Admin role should have both flags
          if (!user.is_admin || !user.is_manager) {
            updates.is_admin = true;
            updates.is_manager = true;
            shouldUpdate = true;
          }
          break;
          
        case 'manager':
          // Manager role should have is_manager flag
          // is_admin remains as set (some managers are admins)
          if (!user.is_manager) {
            updates.is_manager = true;
            shouldUpdate = true;
          }
          break;
          
        case 'sales_rep':
          // Sales reps should have neither flag (unless specifically set as admin)
          if (user.is_manager && !user.is_admin) {
            // If they're not admin but have manager flag, remove it
            updates.is_manager = false;
            shouldUpdate = true;
          }
          break;
          
        default:
          // For any custom roles, check if they should be managers
          // This handles cases like 'Team Lead', 'Sales Manager', etc.
          if (user.role.toLowerCase().includes('lead') || 
              user.role.toLowerCase().includes('manager') ||
              user.role.toLowerCase().includes('director') ||
              user.role.toLowerCase().includes('vp')) {
            if (!user.is_manager) {
              updates.is_manager = true;
              shouldUpdate = true;
            }
          }
      }

      if (shouldUpdate) {
        await prisma.users.update({
          where: { id: user.id },
          data: updates
        });
        
        console.log(`✅ Updated ${user.email}:`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Changes: ${JSON.stringify(updates)}`);
        console.log(`   Company: ${user.company?.name || 'Unknown'}\n`);
        
        stats.updated++;
      } else {
        // Check for potential mismatches
        if (user.role === 'sales_rep' && (user.is_admin || user.is_manager)) {
          stats.flagMismatches.push({
            email: user.email,
            role: user.role,
            is_admin: user.is_admin,
            is_manager: user.is_manager,
            note: 'Sales rep with elevated permissions'
          });
        }
      }
    }

    // Step 4: Report results
    console.log('\n📊 Migration Summary:');
    console.log(`   Total users: ${stats.total}`);
    console.log(`   Updated: ${stats.updated}`);
    console.log(`   Unchanged: ${stats.total - stats.updated}`);
    
    if (stats.flagMismatches.length > 0) {
      console.log(`\n⚠️  Found ${stats.flagMismatches.length} potential mismatches:`);
      stats.flagMismatches.forEach(mismatch => {
        console.log(`   - ${mismatch.email}: ${mismatch.note}`);
        console.log(`     (role=${mismatch.role}, is_admin=${mismatch.is_admin}, is_manager=${mismatch.is_manager})`);
      });
    }

    // Step 5: Verify final state
    console.log('\n🔍 Verifying final state...');
    const finalStats = await prisma.users.groupBy({
      by: ['role', 'is_admin', 'is_manager'],
      _count: true,
      orderBy: [
        { role: 'asc' },
        { is_admin: 'desc' },
        { is_manager: 'desc' }
      ]
    });

    console.log('\n📋 Final permission distribution:');
    console.log('Role         | is_admin | is_manager | Count');
    console.log('-------------|----------|------------|-------');
    finalStats.forEach(stat => {
      console.log(
        `${stat.role.padEnd(12)} | ${stat.is_admin.toString().padEnd(8)} | ${stat.is_manager.toString().padEnd(10)} | ${stat._count}`
      );
    });

    console.log('\n✨ Migration complete!');
    
    // Step 6: Provide recommendations
    console.log('\n📝 Next Steps:');
    console.log('1. Update roleHelpers.js to use only boolean flags');
    console.log('2. Update all permission checks to use is_admin/is_manager');
    console.log('3. Consider deprecating the role field or using it for display only');
    console.log('4. Update frontend to check flags instead of role strings');

  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateToFlagBasedPermissions();