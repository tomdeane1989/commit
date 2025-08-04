// Safe Database Seeding Script
// This script includes protection against accidental data deletion

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { 
  isDatabaseOperationAllowed, 
  confirmDangerousOperation,
  displayDatabaseStats,
  PROTECTED_OPERATIONS,
  getDatabaseStats
} from './database-protection.js';

const prisma = new PrismaClient();

async function safeSeedDatabase() {
  try {
    console.log('🌱 Starting SAFE database seeding...');
    
    // Check current database state
    await displayDatabaseStats();
    const stats = await getDatabaseStats();
    
    // If database has data, require explicit confirmation
    if (stats && Object.values(stats).some(count => count > 0)) {
      console.log('\n⚠️  WARNING: Database contains existing data!');
      
      // Check for force flag
      const forceFlag = process.argv.includes('--force');
      if (!forceFlag) {
        console.log(`
This database is not empty. Seeding would potentially overwrite existing data.

Options:
1. Use --force flag to proceed anyway (with additional confirmation)
2. Clear specific data first using appropriate scripts
3. Cancel this operation

To proceed with seeding:
  node seed-data-safe.js --force
`);
        process.exit(1);
      }
      
      // Even with --force, require environment variable
      if (!isDatabaseOperationAllowed(PROTECTED_OPERATIONS.DELETE_ALL_DATA)) {
        process.exit(1);
      }
      
      // Interactive confirmation
      const confirmed = await confirmDangerousOperation(
        'SEED_WITH_EXISTING_DATA',
        'This will add seed data to a database that already contains data.\nExisting data may be affected.'
      );
      
      if (!confirmed) {
        console.log('❌ Seeding cancelled by user');
        process.exit(0);
      }
    }
    
    // Create backup warning
    console.log('\n📸 IMPORTANT: Make sure you have a database backup!');
    console.log('   Run: pg_dump sales_commission_db > backup_$(date +%Y%m%d_%H%M%S).sql\n');
    
    // Proceed with safe seeding
    console.log('✅ Proceeding with safe seeding...\n');
    
    // Check if test company exists
    let testCompany = await prisma.companies.findFirst({
      where: { name: 'Test Company' }
    });
    
    if (!testCompany) {
      console.log('Creating Test Company...');
      testCompany = await prisma.companies.create({
        data: {
          name: 'Test Company',
          domain: 'testcompany.com',
          fiscal_year_start: 1,
          default_commission_rate: 0.05
        }
      });
      console.log('✓ Company created:', testCompany.name);
    } else {
      console.log('✓ Test Company already exists');
    }
    
    // Check if test user exists
    let testUser = await prisma.users.findFirst({
      where: { email: 'test@company.com' }
    });
    
    if (!testUser) {
      console.log('Creating test user...');
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      testUser = await prisma.users.create({
        data: {
          email: 'test@company.com',
          password: hashedPassword,
          first_name: 'Test',
          last_name: 'User',
          role: 'manager',
          is_admin: true,
          company_id: testCompany.id
        }
      });
      console.log('✓ User created:', testUser.email);
    } else {
      console.log('✓ Test user already exists');
    }
    
    console.log('\n✅ Safe seeding completed successfully!');
    console.log('   No existing data was deleted.');
    
  } catch (error) {
    console.error('❌ Error during safe seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Add signal handlers for cleanup
process.on('SIGINT', async () => {
  console.log('\n⚠️  Seeding interrupted by user');
  await prisma.$disconnect();
  process.exit(0);
});

// Run the safe seed function
safeSeedDatabase().catch(async (error) => {
  console.error('Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});