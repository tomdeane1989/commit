#!/usr/bin/env node

// Safe Migration Wrapper
// Prevents accidental database resets without explicit permission

import { exec } from 'child_process';
import { promisify } from 'util';
import { 
  isDatabaseOperationAllowed, 
  confirmDangerousOperation,
  displayDatabaseStats,
  PROTECTED_OPERATIONS
} from './database-protection.js';

const execAsync = promisify(exec);

async function safeMigrate() {
  const args = process.argv.slice(2);
  const command = args.join(' ');
  
  console.log('🔍 Prisma migrate command:', command);
  
  // Check for dangerous commands
  const dangerousCommands = ['reset', 'dev --create-only'];
  const isDangerous = dangerousCommands.some(cmd => command.includes(cmd));
  
  if (isDangerous) {
    console.log('\n⚠️  DANGEROUS MIGRATION DETECTED!');
    
    // Show current database state
    await displayDatabaseStats();
    
    // Check environment permission
    if (!isDatabaseOperationAllowed(PROTECTED_OPERATIONS.RESET)) {
      console.log('\n❌ Migration blocked for safety.');
      console.log('   Use regular migrations instead: npx prisma migrate dev');
      process.exit(1);
    }
    
    // Interactive confirmation
    const confirmed = await confirmDangerousOperation(
      'DATABASE_MIGRATION_RESET',
      `This will run: npx prisma migrate ${command}\n\nThis command will DELETE ALL DATA in your database!`
    );
    
    if (!confirmed) {
      console.log('❌ Migration cancelled by user');
      process.exit(0);
    }
    
    // Create backup reminder
    console.log('\n📸 LAST CHANCE: Create a backup now!');
    console.log('   Run: pg_dump sales_commission_db > backup_$(date +%Y%m%d_%H%M%S).sql');
    console.log('   Press Ctrl+C to cancel and create backup first.\n');
    
    // Give user time to cancel
    console.log('⏱️  Proceeding in 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  // Run the migration
  try {
    console.log('\n🚀 Running migration...');
    const { stdout, stderr } = await execAsync(`npx prisma migrate ${command}`);
    
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    
    console.log('\n✅ Migration completed');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the safe migration
safeMigrate().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});