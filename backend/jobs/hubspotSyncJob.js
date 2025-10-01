// HubSpot Automated Sync Job
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import HubSpotService from '../services/hubspot.js';

const prisma = new PrismaClient();

// Track active sync jobs to prevent overlapping
const activeSyncs = new Map();

/**
 * Run incremental sync for a single integration
 */
async function syncIntegration(integration) {
  const startTime = Date.now();
  console.log(`🔄 Starting sync for company ${integration.company_id}`);
  
  try {
    // Mark as syncing
    await prisma.crm_integrations.update({
      where: { id: integration.id },
      data: { sync_status: 'syncing' }
    });
    
    // Perform incremental sync
    const result = await HubSpotService.syncDealsIncremental(integration.company_id);
    
    // Handle pagination if there are more results
    let totalSynced = result.deals_synced;
    let cursor = result.next_cursor;
    
    while (cursor && totalSynced < 1000) { // Limit to 1000 deals per sync run
      console.log(`📄 Fetching next page with cursor: ${cursor}`);
      const nextResult = await HubSpotService.syncDealsIncremental(
        integration.company_id, 
        { after: cursor }
      );
      
      totalSynced += nextResult.deals_synced;
      cursor = nextResult.next_cursor;
      
      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Update status to success
    await prisma.crm_integrations.update({
      where: { id: integration.id },
      data: {
        sync_status: 'idle',
        last_sync: new Date(),
        error_count: 0,
        sync_cursor: cursor || null // Save cursor for next run if needed
      }
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ Sync completed for ${integration.company_id}: ${totalSynced} deals in ${duration}ms`);
    
    // Log successful sync
    await prisma.activity_log.create({
      data: {
        user_id: integration.company_id, // Use company as user for automated syncs
        company_id: integration.company_id,
        action: 'hubspot_auto_sync',
        entity_type: 'integration',
        entity_id: integration.id,
        success: true,
        response_time_ms: duration,
        context: {
          deals_synced: totalSynced,
          sync_type: 'incremental',
          automated: true
        }
      }
    });
    
    return { success: true, deals_synced: totalSynced };
    
  } catch (error) {
    console.error(`❌ Sync failed for ${integration.company_id}:`, error.message);
    
    // Update error status
    await prisma.crm_integrations.update({
      where: { id: integration.id },
      data: {
        sync_status: 'error',
        last_error_message: error.message,
        error_count: { increment: 1 }
      }
    });
    
    // Log failed sync
    await prisma.activity_log.create({
      data: {
        user_id: integration.company_id,
        company_id: integration.company_id,
        action: 'hubspot_auto_sync',
        entity_type: 'integration',
        entity_id: integration.id,
        success: false,
        error_message: error.message,
        context: {
          sync_type: 'incremental',
          automated: true
        }
      }
    });
    
    // If error count is too high, consider disabling the integration
    const updatedIntegration = await prisma.crm_integrations.findUnique({
      where: { id: integration.id }
    });
    
    if (updatedIntegration && updatedIntegration.error_count >= 10) {
      console.error(`⚠️ Disabling integration ${integration.id} due to repeated failures`);
      await prisma.crm_integrations.update({
        where: { id: integration.id },
        data: {
          is_active: false,
          sync_status: 'disabled',
          last_error_message: 'Disabled due to repeated sync failures'
        }
      });
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Main sync job that runs for all active integrations
 */
async function runHubSpotSyncJob() {
  console.log('🚀 HubSpot sync job started at', new Date().toISOString());
  
  try {
    // Get all active HubSpot integrations
    const integrations = await prisma.crm_integrations.findMany({
      where: {
        crm_type: 'hubspot',
        is_active: true,
        sync_status: { not: 'syncing' } // Skip if already syncing
      }
    });
    
    if (integrations.length === 0) {
      console.log('No active HubSpot integrations to sync');
      return;
    }
    
    console.log(`Found ${integrations.length} active HubSpot integrations to sync`);
    
    // Process integrations in parallel (max 3 at a time to avoid rate limits)
    const batchSize = 3;
    const results = [];
    
    for (let i = 0; i < integrations.length; i += batchSize) {
      const batch = integrations.slice(i, i + batchSize);
      
      // Check if any in this batch are already syncing
      const filteredBatch = batch.filter(integration => {
        if (activeSyncs.has(integration.id)) {
          console.log(`⏭️ Skipping ${integration.id} - already syncing`);
          return false;
        }
        activeSyncs.set(integration.id, true);
        return true;
      });
      
      const batchResults = await Promise.allSettled(
        filteredBatch.map(integration => syncIntegration(integration))
      );
      
      // Clear active syncs
      filteredBatch.forEach(integration => {
        activeSyncs.delete(integration.id);
      });
      
      results.push(...batchResults);
      
      // Small delay between batches
      if (i + batchSize < integrations.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Summary
    const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value?.success).length;
    
    console.log(`📊 Sync job completed: ${successful} successful, ${failed} failed`);
    
  } catch (error) {
    console.error('Fatal error in HubSpot sync job:', error);
  }
}

/**
 * Schedule the sync job
 * Default: Run every 30 minutes
 */
export function scheduleHubSpotSync(schedule = '*/30 * * * *') {
  const syncSchedule = process.env.HUBSPOT_SYNC_SCHEDULE || schedule;
  
  console.log(`📅 Scheduling HubSpot sync with cron: ${syncSchedule}`);
  
  // Schedule the job
  const job = cron.schedule(syncSchedule, runHubSpotSyncJob, {
    scheduled: false, // Start manually to ensure it's running
    timezone: process.env.TZ || 'UTC'
  });
  
  // Start the cron job
  job.start();
  console.log('✅ HubSpot sync cron job started');
  
  // Run immediately on startup if configured
  if (process.env.HUBSPOT_SYNC_ON_STARTUP === 'true') {
    console.log('Running initial HubSpot sync...');
    runHubSpotSyncJob();
  }
  
  return job;
}

/**
 * Manual trigger for sync job (for testing or manual runs)
 */
export async function triggerManualSync(companyId = null) {
  if (companyId) {
    // Sync specific company
    const integration = await prisma.crm_integrations.findFirst({
      where: {
        company_id: companyId,
        crm_type: 'hubspot',
        is_active: true
      }
    });
    
    if (!integration) {
      throw new Error('No active HubSpot integration found for this company');
    }
    
    return await syncIntegration(integration);
  } else {
    // Sync all
    return await runHubSpotSyncJob();
  }
}

/**
 * Get sync job status
 */
export async function getSyncJobStatus() {
  const integrations = await prisma.crm_integrations.findMany({
    where: {
      crm_type: 'hubspot'
    },
    select: {
      id: true,
      company_id: true,
      sync_status: true,
      last_sync: true,
      error_count: true,
      last_error_message: true,
      is_active: true
    }
  });
  
  return {
    active_syncs: Array.from(activeSyncs.keys()),
    integrations: integrations.map(i => ({
      ...i,
      is_syncing: activeSyncs.has(i.id)
    }))
  };
}

// Cleanup function for graceful shutdown
export function stopHubSpotSync() {
  console.log('Stopping HubSpot sync job...');
  cron.getTasks().forEach(task => task.stop());
}

// Handle process termination
process.on('SIGTERM', stopHubSpotSync);
process.on('SIGINT', stopHubSpotSync);

export default {
  scheduleHubSpotSync,
  triggerManualSync,
  getSyncJobStatus,
  stopHubSpotSync
};