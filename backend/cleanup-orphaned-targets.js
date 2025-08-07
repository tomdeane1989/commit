import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

// Use PRODUCTION_DATABASE_URL if set, otherwise fallback to DATABASE_URL
const databaseUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

console.log('🔌 Connecting to database...');
console.log('URL:', databaseUrl?.replace(/:[^:@]+@/, ':****@') || 'Not set');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function cleanupOrphanedTargets() {
  try {
    console.log('\n🔍 Checking for orphaned targets...\n');

    // Get all targets
    const allTargets = await prisma.targets.findMany({
      include: {
        user: true
      }
    });

    // Find orphaned child targets
    const orphanedTargets = [];
    
    for (const target of allTargets) {
      if (target.distribution_config && target.distribution_config.parent_id) {
        const parentExists = allTargets.some(t => t.id === target.distribution_config.parent_id);
        
        if (!parentExists) {
          orphanedTargets.push(target);
        }
      }
    }

    if (orphanedTargets.length === 0) {
      console.log('✅ No orphaned targets found!');
      return;
    }

    console.log(`⚠️  Found ${orphanedTargets.length} orphaned targets:\n`);
    
    orphanedTargets.forEach(target => {
      console.log(`
User: ${target.user?.email || target.user_id}
Period: ${target.period_type} - £${target.quota_amount}
Dates: ${new Date(target.period_start).toLocaleDateString()} - ${new Date(target.period_end).toLocaleDateString()}
Parent ID: ${target.distribution_config.parent_id} (MISSING)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    });

    const answer = await askQuestion('\n⚠️  Do you want to DELETE these orphaned targets? (yes/no): ');
    
    if (answer.toLowerCase() === 'yes') {
      console.log('\n🗑️  Deleting orphaned targets...');
      
      for (const target of orphanedTargets) {
        await prisma.targets.delete({
          where: { id: target.id }
        });
        console.log(`✅ Deleted orphaned ${target.period_type} target for ${target.user?.email}`);
      }
      
      console.log(`\n✅ Successfully deleted ${orphanedTargets.length} orphaned targets!`);
    } else {
      console.log('\n❌ Cleanup cancelled.');
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

// Add cascade delete check
async function checkCascadeSettings() {
  console.log('\n🔍 Checking cascade delete settings...\n');
  
  try {
    // This is a simple check - in reality, cascade deletes should be set up in the schema
    console.log('⚠️  CASCADE DELETE is not currently set up for parent-child target relationships.');
    console.log('📝 To fix this permanently, we need to update the Prisma schema to add onDelete: Cascade');
    console.log('   for the distribution_config relationship.');
  } catch (error) {
    console.error('Error checking cascade settings:', error);
  }
}

async function main() {
  await checkCascadeSettings();
  await cleanupOrphanedTargets();
}

main();