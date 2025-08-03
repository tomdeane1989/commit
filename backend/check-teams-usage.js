import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkTeamsUsage() {
  try {
    // Check if any teams exist
    const teams = await prisma.teams.findMany({
      include: {
        team_lead: {
          select: { email: true, first_name: true, last_name: true }
        },
        team_members: {
          include: {
            user: {
              select: { email: true, first_name: true, last_name: true }
            }
          }
        }
      }
    });
    
    console.log(`Found ${teams.length} teams in the system:`);
    
    teams.forEach(team => {
      console.log(`\n📋 Team: ${team.team_name}`);
      console.log(`   Description: ${team.description || 'None'}`);
      console.log(`   Team Lead: ${team.team_lead ? team.team_lead.email : 'None'}`);
      console.log(`   Default Role: ${team.default_role || 'None'}`);
      console.log(`   Default Sub-role: ${team.default_sub_role || 'None'}`);
      console.log(`   Members: ${team.team_members.length}`);
      
      team.team_members.forEach(member => {
        console.log(`     - ${member.user.first_name} ${member.user.last_name} (${member.user.email})`);
        console.log(`       Role Override: ${member.role_override || 'None'}`);
        console.log(`       Sub-role Override: ${member.sub_role_override || 'None'}`);
      });
    });
    
    // Check how current system uses teams vs individual user fields
    const usersWithTeams = await prisma.users.findMany({
      where: { company_id: 'cmdkbhgmy0000sli0q3a52nnn' },
      select: {
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        sub_role: true,
        is_manager: true,
        manager_id: true,
        reports_to_id: true,
        team_memberships: {
          include: {
            team: {
              select: { team_name: true }
            }
          }
        }
      }
    });
    
    console.log(`\n👥 Current Users and Their Team Assignments:`);
    usersWithTeams.forEach(user => {
      console.log(`\n${user.first_name} ${user.last_name} (${user.email})`);
      console.log(`  User Role: ${user.role}`);
      console.log(`  User Sub-role: ${user.sub_role || 'None'}`);
      console.log(`  Is Manager: ${user.is_manager}`);
      console.log(`  Reports To ID: ${user.reports_to_id || 'None'}`);
      console.log(`  Team Memberships: ${user.team_memberships.length}`);
      
      user.team_memberships.forEach(membership => {
        console.log(`    - Member of: ${membership.team.team_name}`);
      });
    });
    
  } catch (error) {
    console.error('Error checking teams usage:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTeamsUsage();