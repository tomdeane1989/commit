import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkTomConfig() {
  try {
    // Get Tom's current config
    const tom = await prisma.users.findFirst({
      where: { email: 'tom@test.com' },
      select: { 
        id: true, 
        email: true,
        first_name: true,
        last_name: true,
        role: true, 
        sub_role: true,
        is_manager: true,
        is_admin: true,
        manager_id: true
      }
    });
    
    console.log('Tom current config:', JSON.stringify(tom, null, 2));
    
    // Get his team members and their manager assignments
    const teamMembers = await prisma.users.findMany({
      where: { 
        company_id: 'cmdkbhgmy0000sli0q3a52nnn',
        is_active: true,
        email: { not: 'tom@test.com' }
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        sub_role: true,
        manager_id: true,
        manager: {
          select: {
            email: true,
            first_name: true,
            last_name: true
          }
        }
      }
    });
    
    console.log('Team members and their managers:');
    teamMembers.forEach(member => {
      console.log(`  - ${member.first_name} ${member.last_name} (${member.email}) - Role: ${member.role} - Manager: ${member.manager ? member.manager.email : 'None'}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTomConfig();