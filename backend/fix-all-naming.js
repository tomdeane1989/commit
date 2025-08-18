import { PrismaClient } from '@prisma/client';
import { generateTargetName } from './utils/targetNaming.js';

const prisma = new PrismaClient();

async function fixAllNaming() {
  console.log('🔧 Fixing all commission target naming...\n');
  
  try {
    // Get all commissions with bad naming
    const badCommissions = await prisma.commissions.findMany({
      where: {
        OR: [
          { target_name: { contains: 'GMT' } },
          { target_name: { contains: ' - ' } },
          { target_name: null }
        ]
      },
      include: {
        user: { select: { first_name: true, last_name: true } },
        target: true
      }
    });
    
    console.log(`Found ${badCommissions.length} commissions with bad naming`);
    
    let fixed = 0;
    for (const commission of badCommissions) {
      if (commission.target && commission.user) {
        const correctName = generateTargetName(
          commission.user,
          commission.target.period_type,
          commission.target.period_start,
          commission.target.period_end
        );
        
        await prisma.commissions.update({
          where: { id: commission.id },
          data: { target_name: correctName }
        });
        
        console.log(`✅ Fixed: ${commission.user.first_name} ${commission.user.last_name} -> ${correctName}`);
        fixed++;
      } else if (!commission.target) {
        console.log(`⚠️ No target for commission ${commission.id}`);
      }
    }
    
    console.log(`\n✅ Fixed ${fixed} commission records`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAllNaming();