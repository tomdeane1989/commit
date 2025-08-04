// Database Protection Configuration
// This file implements safeguards to prevent accidental database wipes

import { PrismaClient } from '@prisma/client';
import readline from 'readline';
import { promisify } from 'util';

const prisma = new PrismaClient();

// Configuration for protected operations
export const PROTECTED_OPERATIONS = {
  RESET: 'DATABASE_RESET',
  DROP_ALL: 'DROP_ALL_TABLES',
  DELETE_ALL_USERS: 'DELETE_ALL_USERS',
  DELETE_ALL_DATA: 'DELETE_ALL_DATA',
  TRUNCATE: 'TRUNCATE_TABLES'
};

// Check if operation is allowed
export function isDatabaseOperationAllowed(operation) {
  // Check for explicit permission environment variable
  const allowDestructive = process.env.ALLOW_DESTRUCTIVE_DATABASE_OPERATIONS === 'true';
  const allowSpecific = process.env[`ALLOW_${operation}`] === 'true';
  
  if (!allowDestructive && !allowSpecific) {
    console.error(`
❌ DESTRUCTIVE OPERATION BLOCKED: ${operation}

This operation would permanently delete data from the database.

To allow this operation, you must explicitly set one of these environment variables:
- ALLOW_DESTRUCTIVE_DATABASE_OPERATIONS=true (allows all destructive operations)
- ALLOW_${operation}=true (allows only this specific operation)

Example:
  ALLOW_${operation}=true node your-script.js

This safeguard prevents accidental data loss.
`);
    return false;
  }
  
  return true;
}

// Interactive confirmation for dangerous operations
export async function confirmDangerousOperation(operation, description) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = promisify(rl.question).bind(rl);
  
  console.log(`
⚠️  DANGEROUS OPERATION: ${operation}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${description}

This operation will PERMANENTLY DELETE data.
`);

  const answer = await question('Type "DELETE MY DATA" to confirm, or anything else to cancel: ');
  rl.close();
  
  return answer === 'DELETE MY DATA';
}

// Check current database statistics before destructive operations
export async function getDatabaseStats() {
  try {
    const stats = {
      users: await prisma.users.count(),
      companies: await prisma.companies.count(),
      deals: await prisma.deals.count(),
      targets: await prisma.targets.count(),
      commissions: await prisma.commissions.count(),
      teams: await prisma.teams.count(),
      team_members: await prisma.team_members.count()
    };
    
    return stats;
  } catch (error) {
    console.error('Error getting database stats:', error);
    return null;
  }
}

// Display database statistics
export async function displayDatabaseStats() {
  const stats = await getDatabaseStats();
  
  if (!stats) {
    console.log('Could not retrieve database statistics');
    return;
  }
  
  console.log(`
📊 Current Database Statistics:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Users:        ${stats.users}
  Companies:    ${stats.companies}
  Deals:        ${stats.deals}
  Targets:      ${stats.targets}
  Commissions:  ${stats.commissions}
  Teams:        ${stats.teams}
  Team Members: ${stats.team_members}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TOTAL RECORDS: ${Object.values(stats).reduce((a, b) => a + b, 0)}
`);
}

// Wrapper for dangerous Prisma operations
export function protectedPrismaClient() {
  return new Proxy(prisma, {
    get(target, prop) {
      // Intercept dangerous methods
      if (prop === '$executeRawUnsafe' || prop === '$executeRaw') {
        return async (...args) => {
          const query = args[0].toLowerCase();
          if (query.includes('drop') || query.includes('truncate') || query.includes('delete from')) {
            if (!isDatabaseOperationAllowed(PROTECTED_OPERATIONS.DROP_ALL)) {
              throw new Error('Destructive database operation blocked by safety check');
            }
          }
          return target[prop](...args);
        };
      }
      
      // Intercept model operations
      const value = target[prop];
      if (value && typeof value === 'object') {
        return new Proxy(value, {
          get(modelTarget, modelProp) {
            if (modelProp === 'deleteMany' && !args[0]) {
              // deleteMany without arguments deletes all records
              return async (...args) => {
                if (!args[0] || Object.keys(args[0]).length === 0) {
                  if (!isDatabaseOperationAllowed(PROTECTED_OPERATIONS.DELETE_ALL_DATA)) {
                    throw new Error('Delete all records blocked by safety check');
                  }
                }
                return modelTarget[modelProp](...args);
              };
            }
            return modelTarget[modelProp];
          }
        });
      }
      
      return value;
    }
  });
}

// Export protected prisma instance
export const protectedPrisma = protectedPrismaClient();

// Cleanup
export async function cleanup() {
  await prisma.$disconnect();
}