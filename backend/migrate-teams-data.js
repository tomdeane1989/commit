// migrate-teams-data.js
// Script to create default teams based on existing manager relationships

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function migrateTeamsData() {
  console.log('🚀 Starting team data migration...');
  
  try {
    // Get all companies
    const companies = await prisma.companies.findMany({
      include: {
        users: {
          where: {
            is_active: true
          },
          orderBy: {
            created_at: 'asc'
          }
        }
      }
    });

    console.log(`Found ${companies.length} companies to process`);

    for (const company of companies) {
      console.log(`\n📊 Processing company: ${company.name}`);
      
      // Find all managers in the company
      const managers = company.users.filter(u => u.is_manager === true || u.role === 'manager');
      console.log(`  Found ${managers.length} managers`);

      // Find the primary admin (first created admin or first manager)
      const admin = company.users.find(u => u.is_admin === true) || managers[0];
      
      if (!admin) {
        console.log(`  ⚠️  No admin found for company ${company.name}, skipping...`);
        continue;
      }

      // Check if teams already exist for this company
      const existingTeams = await prisma.teams.count({
        where: { company_id: company.id }
      });

      if (existingTeams > 0) {
        console.log(`  ℹ️  Teams already exist for ${company.name}, skipping...`);
        continue;
      }

      // Create teams based on manager relationships
      for (const manager of managers) {
        // Find all users who report to this manager
        const teamMembers = company.users.filter(u => u.manager_id === manager.id);
        
        if (teamMembers.length === 0 && manager.id !== admin.id) {
          console.log(`  Manager ${manager.first_name} ${manager.last_name} has no direct reports, skipping team creation...`);
          continue;
        }

        // Create a team for this manager
        const teamName = `${manager.first_name} ${manager.last_name}'s Team`;
        console.log(`  Creating team: ${teamName}`);

        try {
          const team = await prisma.teams.create({
            data: {
              team_name: teamName,
              description: `Team led by ${manager.first_name} ${manager.last_name}`,
              company_id: company.id,
              team_lead_id: manager.id,
              created_by_admin_id: admin.id,
              default_role: 'sales_rep',
              is_active: true
            }
          });

          console.log(`    ✅ Team created with ID: ${team.id}`);

          // Add team members
          const membersToAdd = [...teamMembers, manager]; // Include the manager as a team member
          
          for (const member of membersToAdd) {
            try {
              await prisma.team_members.create({
                data: {
                  team_id: team.id,
                  user_id: member.id,
                  added_by_admin_id: admin.id,
                  is_active: true,
                  role_override: member.role,
                  joined_date: member.created_at
                }
              });
              console.log(`    Added ${member.first_name} ${member.last_name} to team`);
            } catch (memberError) {
              console.error(`    ❌ Error adding member ${member.email}:`, memberError.message);
            }
          }

          // Log the activity
          await prisma.activity_log.create({
            data: {
              user_id: admin.id,
              company_id: company.id,
              action: 'team_migrated',
              entity_type: 'team',
              entity_id: team.id,
              context: {
                team_name: teamName,
                manager_email: manager.email,
                member_count: membersToAdd.length,
                migration_script: true
              },
              success: true
            }
          });

        } catch (teamError) {
          console.error(`  ❌ Error creating team for ${manager.email}:`, teamError.message);
        }
      }

      // Create a general team for users without managers (if any)
      const orphanedUsers = company.users.filter(u => 
        !u.manager_id && 
        !managers.find(m => m.id === u.id) && 
        u.role === 'sales_rep'
      );

      if (orphanedUsers.length > 0) {
        console.log(`  Found ${orphanedUsers.length} users without managers`);
        
        try {
          const generalTeam = await prisma.teams.create({
            data: {
              team_name: 'General Sales Team',
              description: 'Team for sales representatives without assigned managers',
              company_id: company.id,
              team_lead_id: admin.id,
              created_by_admin_id: admin.id,
              default_role: 'sales_rep',
              is_active: true
            }
          });

          console.log(`    ✅ General team created with ID: ${generalTeam.id}`);

          // Add orphaned users to the general team
          for (const user of orphanedUsers) {
            try {
              await prisma.team_members.create({
                data: {
                  team_id: generalTeam.id,
                  user_id: user.id,
                  added_by_admin_id: admin.id,
                  is_active: true,
                  role_override: user.role,
                  joined_date: user.created_at
                }
              });
              console.log(`    Added ${user.first_name} ${user.last_name} to general team`);
            } catch (memberError) {
              console.error(`    ❌ Error adding member ${user.email}:`, memberError.message);
            }
          }
        } catch (generalTeamError) {
          console.error(`  ❌ Error creating general team:`, generalTeamError.message);
        }
      }
    }

    // Summary statistics
    const totalTeams = await prisma.teams.count();
    const totalMemberships = await prisma.team_members.count({
      where: { is_active: true }
    });

    console.log('\n📈 Migration Summary:');
    console.log(`  Total teams created: ${totalTeams}`);
    console.log(`  Total active memberships: ${totalMemberships}`);

    // Verify data integrity
    console.log('\n🔍 Verifying data integrity...');
    
    // Check for users without teams
    const usersWithoutTeams = await prisma.users.findMany({
      where: {
        is_active: true,
        team_memberships: {
          none: {
            is_active: true
          }
        }
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        company: {
          select: {
            name: true
          }
        }
      }
    });

    if (usersWithoutTeams.length > 0) {
      console.log(`\n⚠️  Found ${usersWithoutTeams.length} active users without team assignments:`);
      usersWithoutTeams.forEach(user => {
        console.log(`  - ${user.first_name} ${user.last_name} (${user.email}) at ${user.company.name}`);
      });
    } else {
      console.log('  ✅ All active users are assigned to teams');
    }

    console.log('\n✅ Team migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateTeamsData()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });