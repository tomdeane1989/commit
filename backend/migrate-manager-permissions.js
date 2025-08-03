/**
 * Migration script to set initial manager permissions
 * Run this once to migrate existing users to the new permission system
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateManagerPermissions() {
  try {
    console.log('🚀 Starting manager permissions migration...');

    // Get all users with their direct reports count
    const users = await prisma.users.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        is_admin: true,
        is_manager: true,
        can_view_all_teams: true,
        _count: {
          select: {
            direct_reports: true
          }
        }
      }
    });

    console.log(`Found ${users.length} users to process`);

    let updateCount = 0;

    for (const user of users) {
      const updates = {};
      let shouldUpdate = false;

      // Set is_manager for users who:
      // 1. Have direct reports
      // 2. Have roles that indicate management (manager, Team Lead, etc.)
      // 3. Are admins (admins should also be managers)
      if (!user.is_manager) {
        const hasDirectReports = user._count.direct_reports > 0;
        const hasManagerRole = user.role && (
          user.role.toLowerCase().includes('manager') ||
          user.role.toLowerCase().includes('lead') ||
          user.role.toLowerCase().includes('head') ||
          user.role.toLowerCase().includes('director')
        );
        const isAdmin = user.is_admin;

        if (hasDirectReports || hasManagerRole || isAdmin) {
          updates.is_manager = true;
          shouldUpdate = true;
          console.log(`  → Setting is_manager=true for ${user.email} (${user.role})`);
        }
      }

      // Set can_view_all_teams for admins if not already set
      if (user.is_admin && !user.can_view_all_teams) {
        updates.can_view_all_teams = true;
        shouldUpdate = true;
        console.log(`  → Setting can_view_all_teams=true for admin ${user.email}`);
      }

      // Apply updates if needed
      if (shouldUpdate) {
        await prisma.users.update({
          where: { id: user.id },
          data: updates
        });
        updateCount++;
      }
    }

    console.log(`✅ Migration completed! Updated ${updateCount} users.`);

    // Display summary
    const summary = await prisma.users.groupBy({
      by: ['is_admin', 'is_manager', 'can_view_all_teams'],
      _count: true
    });

    console.log('\n📊 Permission Summary:');
    summary.forEach(group => {
      const labels = [];
      if (group.is_admin) labels.push('Admin');
      if (group.is_manager) labels.push('Manager');
      if (group.can_view_all_teams) labels.push('Full Access');
      if (labels.length === 0) labels.push('Regular User');
      
      console.log(`  ${labels.join(' + ')}: ${group._count} users`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateManagerPermissions();