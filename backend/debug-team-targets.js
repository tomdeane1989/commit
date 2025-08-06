import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function debugTeamTargets() {
  const teamId = 'cmdx5gyxk0001bey9u38st265';
  
  console.log('🔍 Debugging team targets creation...\n');
  
  // 1. Check if team exists
  const team = await prisma.teams.findUnique({
    where: { id: teamId },
    include: {
      team_members: {
        include: { user: true }
      }
    }
  });
  
  console.log(`Team: ${team?.team_name}`);
  console.log(`Active members: ${team?.team_members.filter(tm => tm.is_active).length}`);
  
  // 2. Check team members
  const teamMembers = await prisma.team_members.findMany({
    where: {
      team_id: teamId,
      is_active: true // Only active team members
    },
    include: {
      user: true
    }
  });
  
  console.log(`\nTeam members query results: ${teamMembers.length}`);
  teamMembers.forEach(tm => {
    console.log(`  - ${tm.user.email} (user active: ${tm.user.is_active}, member active: ${tm.is_active})`);
  });
  
  // 3. Check the field name
  const firstMember = await prisma.team_members.findFirst();
  console.log('\nSample team_member fields:', Object.keys(firstMember || {}));
  
  await prisma.$disconnect();
}

debugTeamTargets();