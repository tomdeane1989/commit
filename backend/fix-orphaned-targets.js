import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixOrphanedTargets() {
  try {
    // Find all active child targets that have parent_target_id
    const childTargets = await prisma.targets.findMany({
      where: {
        parent_target_id: { not: null },
        is_active: true
      },
      select: {
        id: true,
        parent_target_id: true
      }
    });

    console.log(`Found ${childTargets.length} active child targets`);

    const orphanedTargets = [];
    
    // Check each child target to see if its parent is inactive
    for (const child of childTargets) {
      const parent = await prisma.targets.findUnique({
        where: { id: child.parent_target_id },
        select: { is_active: true }
      });
      
      if (!parent || !parent.is_active) {
        orphanedTargets.push(child.id);
      }
    }

    console.log(`Found ${orphanedTargets.length} orphaned child targets with inactive/missing parents`);

    if (orphanedTargets.length > 0) {
      // Deactivate all orphaned child targets
      const result = await prisma.targets.updateMany({
        where: {
          id: { in: orphanedTargets }
        },
        data: { is_active: false }
      });

      console.log(`Deactivated ${result.count} orphaned child targets`);
      console.log('Deactivated target IDs:', orphanedTargets);
    }

  } catch (error) {
    console.error('Error fixing orphaned targets:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixOrphanedTargets();