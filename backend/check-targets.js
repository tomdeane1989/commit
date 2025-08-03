import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkTargets() {
  try {
    const targets = await prisma.targets.findMany({
      where: { is_active: true },
      select: {
        id: true,
        role: true,
        user_id: true,
        quota_amount: true,
        period_type: true,
        is_active: true,
        company_id: true,
        parent_target_id: true,
        team_target: true
      }
    });
    
    console.log('All active targets:', targets.length);
    
    const parentTargets = targets.filter(t => !t.parent_target_id);
    console.log('Parent targets (parent_target_id: null):', parentTargets.length);
    
    const childTargets = targets.filter(t => t.parent_target_id);
    console.log('Child targets (has parent_target_id):', childTargets.length);
    
    // Show company breakdown
    const targetCompany = 'cmdkbhgmy0000sli0q3a52nnn'; // Test company
    const companyTargets = targets.filter(t => t.company_id === targetCompany);
    console.log(`Active targets for company ${targetCompany}:`, companyTargets.length);
    
    const companyChildTargets = companyTargets.filter(t => t.parent_target_id);
    console.log('Company child targets:', JSON.stringify(companyChildTargets, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTargets();