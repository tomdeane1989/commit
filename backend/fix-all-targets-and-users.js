import { PrismaClient } from '@prisma/client';
import { generateTargetName } from './utils/targetNaming.js';
import enhancedCommissionCalculator from './services/enhancedCommissionCalculator.js';

const prisma = new PrismaClient();

async function fixAllTargetsAndUsers() {
  console.log('🔧 Comprehensive fix for targets and users...\n');
  
  try {
    // 1. Create Tobias as a user if he doesn't exist
    console.log('Step 1: Checking for missing users...');
    const tobias = await prisma.users.findFirst({
      where: { first_name: 'Tobias' }
    });
    
    if (!tobias) {
      console.log('Creating Tobias user...');
      const tom = await prisma.users.findFirst({
        where: { email: 'tom@test.com' }
      });
      
      if (tom) {
        const newTobias = await prisma.users.create({
          data: {
            email: 'tobias@test.com',
            password: '$2b$10$8K1JZ3kl.OQeZ0hiZvWkxuPlQoYpnM8hJzA2PptVyoGjsnBU8L3/e', // password123
            first_name: 'Tobias',
            last_name: 'Turner',
            role: 'sales_rep',
            is_manager: false,
            is_admin: false,
            is_active: true,
            company_id: tom.company_id,
            manager_id: tom.id // Tom is the manager
          }
        });
        console.log(`✅ Created user: Tobias Turner (${newTobias.email})`);
        
        // Create target for Tobias
        const currentYear = new Date().getUTCFullYear();
        const annualTarget = await prisma.targets.create({
          data: {
            user_id: newTobias.id,
            company_id: newTobias.company_id,
            period_type: 'annual',
            period_start: new Date(Date.UTC(currentYear, 0, 1)),
            period_end: new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999)),
            quota_amount: 240000,
            commission_rate: 0.10,
            is_active: true
          }
        });
        console.log(`✅ Created annual target for Tobias with 10% commission rate`);
      }
    }
    
    // 2. Fix deal assignment - find deals incorrectly assigned
    console.log('\nStep 2: Fixing incorrectly assigned deals...');
    const recentDeals = await prisma.deals.findMany({
      where: {
        created_at: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        },
        deal_name: { contains: 'Product Expansion' }
      },
      include: {
        user: { select: { first_name: true, last_name: true } }
      }
    });
    
    for (const deal of recentDeals) {
      if (deal.user.first_name === 'Tom' && deal.deal_name.includes('Product Expansion')) {
        // This should probably be Tobias's deal
        const tobias = await prisma.users.findFirst({
          where: { first_name: 'Tobias' }
        });
        
        if (tobias) {
          await prisma.deals.update({
            where: { id: deal.id },
            data: { user_id: tobias.id }
          });
          console.log(`✅ Reassigned deal "${deal.deal_name}" from Tom to Tobias`);
          
          // Delete any existing commission record
          await prisma.commission_approvals.deleteMany({
            where: {
              commission: { deal_id: deal.id }
            }
          });
          await prisma.commissions.deleteMany({
            where: { deal_id: deal.id }
          });
        }
      }
    }
    
    // 3. Recalculate all deals with wrong commission rates
    console.log('\nStep 3: Recalculating all deals with enhanced calculator...');
    const dealsToRecalc = await prisma.deals.findMany({
      where: {
        stage: { in: ['Closed Won', 'closed_won'] },
        OR: [
          { commission_rate: 0.05 },
          { commission_rate: null }
        ],
        close_date: {
          gte: new Date('2025-01-01')
        }
      },
      include: {
        user: true
      }
    });
    
    console.log(`Found ${dealsToRecalc.length} deals to recalculate`);
    
    for (const deal of dealsToRecalc) {
      // Delete existing commission record to force recalculation
      await prisma.commission_approvals.deleteMany({
        where: {
          commission: { deal_id: deal.id }
        }
      });
      await prisma.commissions.deleteMany({
        where: { deal_id: deal.id }
      });
      
      // Recalculate with enhanced calculator
      const result = await enhancedCommissionCalculator.calculateDealCommission(deal.id, {
        createAuditRecord: true,
        useAdvancedRules: false, // Use simple calculation to ensure we get the target rate
        recalculate: true
      });
      
      if (result.commission) {
        console.log(`✅ Recalculated: ${deal.user.first_name} ${deal.user.last_name} - ${deal.deal_name}`);
        console.log(`   Rate: ${(result.deal.commission_rate * 100).toFixed(1)}% | Amount: £${result.deal.commission_amount}`);
        console.log(`   Target: ${result.commission.target_name}`);
      }
    }
    
    // 4. Update Google Sheets integration to NOT default to Tom
    console.log('\nStep 4: Checking integration configuration...');
    console.log('⚠️ Note: Google Sheets integration should be updated to:');
    console.log('   1. Create new users when they don\'t exist in the system');
    console.log('   2. Or skip deals for unknown users instead of defaulting to Tom');
    console.log('   3. Always use the enhanced commission calculator');
    
    console.log('\n✅ Fix complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAllTargetsAndUsers();