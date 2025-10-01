// Token Encryption Migration Utility
// Migrates existing plaintext tokens to encrypted format
import { PrismaClient } from '@prisma/client';
import tokenEncryption from '../services/tokenEncryption.js';

const prisma = new PrismaClient();

async function migrateTokens() {
  console.log('🔐 Starting token encryption migration...');
  
  try {
    // Get all CRM integrations
    const integrations = await prisma.crm_integrations.findMany({
      where: {
        OR: [
          { access_token: { not: null } },
          { refresh_token: { not: null } }
        ]
      }
    });
    
    console.log(`Found ${integrations.length} integrations to check`);
    
    let migrated = 0;
    let alreadyEncrypted = 0;
    let errors = 0;
    
    for (const integration of integrations) {
      try {
        // Check if tokens need migration
        const updates = tokenEncryption.migrateTokens(integration);
        
        if (updates) {
          // Update the integration with encrypted tokens
          await prisma.crm_integrations.update({
            where: { id: integration.id },
            data: updates
          });
          
          console.log(`✅ Migrated tokens for integration ${integration.id} (Company: ${integration.company_id})`);
          migrated++;
        } else {
          console.log(`⏭️ Tokens already encrypted for integration ${integration.id}`);
          alreadyEncrypted++;
        }
      } catch (error) {
        console.error(`❌ Error migrating integration ${integration.id}:`, error.message);
        errors++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Migrated: ${migrated}`);
    console.log(`⏭️ Already encrypted: ${alreadyEncrypted}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📝 Total processed: ${integrations.length}`);
    
    if (errors > 0) {
      console.warn('\n⚠️ Some tokens could not be migrated. Manual intervention may be required.');
    } else if (migrated > 0) {
      console.log('\n🎉 Token migration completed successfully!');
    } else {
      console.log('\n✨ All tokens were already encrypted.');
    }
    
  } catch (error) {
    console.error('Fatal error during migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration if executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  migrateTokens();
}

export default migrateTokens;