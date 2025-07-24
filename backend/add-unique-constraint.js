import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function addUniqueConstraint() {
  try {
    console.log('Adding unique constraint to prevent duplicate CRM deals...');
    
    // First, check if there are any remaining duplicates that would violate the constraint
    const duplicateCheck = await prisma.$queryRaw`
      SELECT crm_id, company_id, COUNT(*) as count
      FROM deals 
      WHERE crm_id IS NOT NULL 
      GROUP BY crm_id, company_id 
      HAVING COUNT(*) > 1
    `;
    
    if (duplicateCheck.length > 0) {
      console.log('❌ Found remaining duplicates that need to be cleaned up:');
      duplicateCheck.forEach(dup => {
        console.log(`  CRM ID: ${dup.crm_id}, Company: ${dup.company_id}, Count: ${dup.count}`);
      });
      
      // Clean up remaining duplicates automatically
      console.log('Cleaning up remaining duplicates...');
      
      for (const dup of duplicateCheck) {
        const duplicateDeals = await prisma.deals.findMany({
          where: {
            crm_id: dup.crm_id,
            company_id: dup.company_id
          },
          orderBy: { created_at: 'asc' } // Keep the oldest
        });
        
        // Delete all but the first (oldest) deal
        const toDelete = duplicateDeals.slice(1).map(d => d.id);
        if (toDelete.length > 0) {
          // Delete categorizations first
          await prisma.deal_categorizations.deleteMany({
            where: { deal_id: { in: toDelete } }
          });
          
          // Delete the duplicate deals
          await prisma.deals.deleteMany({
            where: { id: { in: toDelete } }
          });
          
          console.log(`  Deleted ${toDelete.length} duplicates for CRM ID: ${dup.crm_id}`);
        }
      }
    }
    
    // Now add the unique constraint
    await prisma.$executeRaw`
      ALTER TABLE deals 
      ADD CONSTRAINT unique_crm_deal_per_company 
      UNIQUE (crm_id, company_id)
    `;
    
    console.log('✅ Successfully added unique constraint: unique_crm_deal_per_company');
    console.log('✅ Duplicate CRM deals are now prevented at the database level');
    
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✅ Unique constraint already exists');
    } else {
      console.error('❌ Error adding unique constraint:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

addUniqueConstraint();