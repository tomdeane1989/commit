import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkTomTargets() {
  try {
    // Find tom's user ID first
    const tom = await prisma.users.findFirst({
      where: { email: 'tom@test.com' },
      select: { id: true, role: true }
    });
    
    console.log('Tom user data:', tom);
    
    if (tom) {
      const targets = await prisma.targets.findMany({
        where: {
          user_id: tom.id,
          is_active: true
        },
        select: {
          id: true,
          quota_amount: true,
          period_type: true,
          period_start: true,
          period_end: true,
          role: true,
          parent_target_id: true,
          team_target: true
        }
      });
      
      console.log(`Tom has ${targets.length} active targets:`);
      console.log(JSON.stringify(targets, null, 2));
      
      // Also check if there are any role-based targets for "Team Lead"
      const roleTargets = await prisma.targets.findMany({
        where: {
          role: tom.role,
          is_active: true,
          parent_target_id: null // Only parent targets
        },
        select: {
          id: true,
          quota_amount: true,
          period_type: true,
          role: true,
          user_id: true
        }
      });
      
      console.log(`Role-based targets for ${tom.role}:`, JSON.stringify(roleTargets, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTomTargets();