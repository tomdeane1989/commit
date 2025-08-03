import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function createRoleTargets() {
  try {
    // Create a New Sales role-based target (parent target with no user_id)
    const roleTarget = await prisma.targets.create({
      data: {
        company_id: 'cmdkbhgmy0000sli0q3a52nnn', // Test company ID
        role: 'New Sales',
        user_id: null, // No user_id = role-based target
        quota_amount: 90000,
        commission_rate: 0.1,
        period_type: 'quarterly',
        period_start: new Date('2025-07-01'),
        period_end: new Date('2025-09-30'),
        is_active: true,
        team_target: true,
        parent_target_id: null
      }
    });
    
    console.log('Created role-based target:', roleTarget);
    
    // Also create one for Team Lead role
    const teamLeadTarget = await prisma.targets.create({
      data: {
        company_id: 'cmdkbhgmy0000sli0q3a52nnn',
        role: 'Team Lead',
        user_id: null,
        quota_amount: 150000,
        commission_rate: 0.15,
        period_type: 'quarterly',
        period_start: new Date('2025-07-01'),
        period_end: new Date('2025-09-30'),
        is_active: true,
        team_target: true,
        parent_target_id: null
      }
    });
    
    console.log('Created Team Lead role-based target:', teamLeadTarget);
    
  } catch (error) {
    console.error('Error creating role targets:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createRoleTargets();