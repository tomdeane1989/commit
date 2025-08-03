import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function setupTeamStructure() {
  try {
    const companyId = 'cmdkbhgmy0000sli0q3a52nnn';
    
    // Get Tom's user data
    const tom = await prisma.users.findFirst({
      where: { email: 'tom@test.com' },
      select: { id: true }
    });
    
    if (!tom) {
      throw new Error('Tom not found');
    }
    
    console.log('Tom ID:', tom.id);
    
    // 1. Create the main "New Sales - UK" team with Tom as team lead
    const salesTeam = await prisma.teams.create({
      data: {
        team_name: 'New Sales - UK',
        description: 'UK New Sales team focusing on new customer acquisition',
        default_role: 'Sales Representative',
        default_sub_role: 'New Sales',
        company_id: companyId,
        team_lead_id: tom.id,
        created_by_admin_id: tom.id,
        is_active: true
      }
    });
    
    console.log('Created team:', salesTeam.team_name, salesTeam.id);
    
    // 2. Add Tom as a team member (team leads are also members)
    await prisma.team_members.create({
      data: {
        team_id: salesTeam.id,
        user_id: tom.id,
        role_override: 'Team Lead',
        sub_role_override: 'Manager',
        added_by_admin_id: tom.id,
        is_active: true
      }
    });
    
    console.log('Added Tom as team member with Team Lead role');
    
    // 3. Get all team members and add them to the team
    const teamMembers = await prisma.users.findMany({
      where: {
        email: { in: ['alfie@test.com', 'rob@test.com', 'joel@test.com', 'tobias@test.com', 'egger@test.com'] }
      },
      select: { id: true, email: true, first_name: true, last_name: true }
    });
    
    // Add each team member with specific roles
    const roleAssignments = {
      'alfie@test.com': { role: 'Sales Representative', sub_role: 'Enterprise' },
      'rob@test.com': { role: 'Sales Representative', sub_role: 'Mid-Market' },
      'joel@test.com': { role: 'Sales Representative', sub_role: 'SMB' },
      'tobias@test.com': { role: 'Sales Representative', sub_role: 'Enterprise' },
      'egger@test.com': { role: 'Sales Representative', sub_role: 'SMB' }
    };
    
    for (const member of teamMembers) {
      const assignment = roleAssignments[member.email];
      
      await prisma.team_members.create({
        data: {
          team_id: salesTeam.id,
          user_id: member.id,
          role_override: assignment.role,
          sub_role_override: assignment.sub_role,
          added_by_admin_id: tom.id,
          is_active: true
        }
      });
      
      // Update the user's reports_to_id to point to Tom
      await prisma.users.update({
        where: { id: member.id },
        data: { reports_to_id: tom.id }
      });
      
      console.log(`Added ${member.first_name} ${member.last_name} as ${assignment.role} - ${assignment.sub_role}`);
    }
    
    // 4. Update Tom's role to match his team (New Sales) but keep his manager status
    await prisma.users.update({
      where: { id: tom.id },
      data: {
        role: 'New Sales', // Same as team role
        sub_role: 'Team Lead', // Manager sub-role
        is_manager: true,
        is_admin: true
      }
    });
    
    console.log('Updated Tom role to "New Sales" with "Team Lead" sub-role');
    
    console.log('\\n✅ Team structure setup complete!');
    console.log('Team hierarchy:');
    console.log('├── New Sales - UK (Team)');
    console.log('│   ├── Tom Deane (Team Lead - Manager)');
    console.log('│   ├── Alfie Ferris (Enterprise Rep)');
    console.log('│   ├── Rob Manson (Mid-Market Rep)');
    console.log('│   ├── Joel Savilahti (SMB Rep)');
    console.log('│   ├── Tobias Zellweger (Enterprise Rep)');
    console.log('│   └── Chris Egger (SMB Rep)');
    
  } catch (error) {
    console.error('Error setting up team structure:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupTeamStructure();