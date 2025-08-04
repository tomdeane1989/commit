#!/usr/bin/env node

// Database Backup Script
// Creates timestamped backups of the database

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { displayDatabaseStats } from './database-protection.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function backupDatabase() {
  try {
    console.log('🔄 Starting database backup...\n');
    
    // Show what we're backing up
    await displayDatabaseStats();
    
    // Create backups directory if it doesn't exist
    const backupsDir = path.join(__dirname, 'backups');
    await fs.mkdir(backupsDir, { recursive: true });
    
    // Generate timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `backup_${timestamp}.sql`;
    const filepath = path.join(backupsDir, filename);
    
    // Get database URL from environment or use default
    const databaseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/sales_commission_db';
    
    console.log(`\n📁 Backup file: ${filename}`);
    console.log('⏳ Creating backup...');
    
    // Run pg_dump
    const { stdout, stderr } = await execAsync(
      `pg_dump ${databaseUrl} > "${filepath}"`
    );
    
    if (stderr && !stderr.includes('warning')) {
      console.error('Warning during backup:', stderr);
    }
    
    // Check file size
    const stats = await fs.stat(filepath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    console.log(`\n✅ Backup completed successfully!`);
    console.log(`   File: ${filepath}`);
    console.log(`   Size: ${sizeMB} MB`);
    
    // List recent backups
    const files = await fs.readdir(backupsDir);
    const backupFiles = files
      .filter(f => f.startsWith('backup_') && f.endsWith('.sql'))
      .sort()
      .reverse()
      .slice(0, 5);
    
    console.log(`\n📚 Recent backups:`);
    for (const file of backupFiles) {
      const filePath = path.join(backupsDir, file);
      const fileStats = await fs.stat(filePath);
      const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
      console.log(`   - ${file} (${fileSizeMB} MB)`);
    }
    
    // Restore instructions
    console.log(`\n📝 To restore from this backup:`);
    console.log(`   psql -d sales_commission_db < "${filepath}"`);
    
    return filepath;
    
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    
    if (error.message.includes('pg_dump: command not found')) {
      console.log('\n💡 PostgreSQL client tools not found.');
      console.log('   Install with: brew install postgresql');
    }
    
    throw error;
  }
}

// Check if running directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  backupDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { backupDatabase };