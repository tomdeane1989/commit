import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import dealCommissionCalculator from '../services/dealCommissionCalculator.js';
import HubSpotService from '../services/hubspot.js';

const prisma = new PrismaClient();

/**
 * Daily commission recalculation job
 * Finds and calculates commissions for any closed_won deals that don't have commission calculated
 * This catches any edge cases where the real-time calculation or backfill might have missed deals
 */
export async function runCommissionRecalculation() {
  const startTime = new Date();
  console.log(`🕐 [${startTime.toISOString()}] Starting daily commission recalculation job...`);
  
  try {
    // Find all closed_won deals without commission that have an active target
    const dealsWithoutCommission = await prisma.deals.findMany({
      where: {
        stage: { in: ['closed_won', 'Closed Won', 'closedwon'] }, // Include all variations
        commission_amount: null
      },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    });
    
    console.log(`📊 Found ${dealsWithoutCommission.length} closed deals without commission`);
    
    let successCount = 0;
    let errorCount = 0;
    const userSummary = new Map();
    
    for (const deal of dealsWithoutCommission) {
      try {
        // Check if there's an active target for this deal
        const activeTarget = await prisma.targets.findFirst({
          where: {
            user_id: deal.user_id,
            is_active: true,
            period_start: { lte: deal.close_date },
            period_end: { gte: deal.close_date }
          }
        });
        
        if (activeTarget) {
          await dealCommissionCalculator.calculateDealCommission(deal.id);
          successCount++;
          
          // Track by user for summary
          const userKey = `${deal.user.first_name} ${deal.user.last_name}`;
          userSummary.set(userKey, (userSummary.get(userKey) || 0) + 1);
        }
      } catch (error) {
        console.error(`❌ Error calculating commission for deal ${deal.id}:`, error.message);
        errorCount++;
      }
    }
    
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    
    // Log summary
    console.log(`✅ Daily commission recalculation completed in ${duration.toFixed(2)}s`);
    console.log(`   - Successfully calculated: ${successCount} deals`);
    console.log(`   - Errors: ${errorCount} deals`);
    console.log(`   - Skipped (no active target): ${dealsWithoutCommission.length - successCount - errorCount} deals`);
    
    if (userSummary.size > 0) {
      console.log(`   - By user:`);
      for (const [user, count] of userSummary) {
        console.log(`     • ${user}: ${count} deals`);
      }
    }
    
    // Log to activity_log for audit trail (skip if no system user exists)
    try {
      // Find a system user or admin user for logging
      const systemUser = await prisma.users.findFirst({
        where: { 
          OR: [
            { email: 'system@company.com' },
            { is_admin: true }
          ]
        },
        orderBy: { created_at: 'asc' }
      });
      
      if (systemUser) {
        await prisma.activity_log.create({
          data: {
            action: 'commission_recalculation_job',
            entity_type: 'system',
            entity_id: 'daily_job',
            after_state: {
              total_deals_processed: dealsWithoutCommission.length,
              successful_calculations: successCount,
              errors: errorCount,
              duration_seconds: duration,
              user_summary: Object.fromEntries(userSummary)
            },
            response_time_ms: Math.round(duration * 1000),
            success: errorCount === 0,
            error_message: errorCount > 0 ? `${errorCount} deals failed to calculate` : null,
            user_id: systemUser.id,
            company_id: systemUser.company_id
          }
        });
      }
    } catch (logError) {
      console.log('⚠️ Could not log to activity_log:', logError.message);
    }
    
  } catch (error) {
    console.error('❌ Fatal error in commission recalculation job:', error);
    
    // Try to log error to activity_log
    try {
      const systemUser = await prisma.users.findFirst({
        where: { 
          OR: [
            { email: 'system@company.com' },
            { is_admin: true }
          ]
        },
        orderBy: { created_at: 'asc' }
      });
      
      if (systemUser) {
        await prisma.activity_log.create({
          data: {
            action: 'commission_recalculation_job',
            entity_type: 'system',
            entity_id: 'daily_job',
            after_state: { error: error.message },
            success: false,
            error_message: error.message,
            user_id: systemUser.id,
            company_id: systemUser.company_id
          }
        });
      }
    } catch (logError) {
      console.log('⚠️ Could not log error to activity_log:', logError.message);
    }
  }
}

/**
 * HubSpot sync job
 * Syncs deals from HubSpot for all active integrations
 */
export async function runHubSpotSync() {
  const startTime = new Date();
  console.log(`🔄 [${startTime.toISOString()}] Starting HubSpot sync job...`);
  
  try {
    // Find all active HubSpot integrations
    const activeIntegrations = await prisma.crm_integrations.findMany({
      where: {
        crm_type: 'hubspot',
        is_active: true
      }
    });
    
    console.log(`📊 Found ${activeIntegrations.length} active HubSpot integrations to sync`);
    
    let totalSynced = 0;
    let totalErrors = 0;
    
    for (const integration of activeIntegrations) {
      try {
        console.log(`  Syncing HubSpot for company: ${integration.company_id}`);
        
        // Perform sync with default options (limit 100 deals per sync)
        const result = await HubSpotService.syncDeals(integration.company_id, {
          limit: 100
        });
        
        totalSynced += result.deals_synced || 0;
        
        console.log(`  ✅ Synced ${result.deals_synced} deals for company ${integration.company_id}`);
        
        // Log the sync activity (skip if no valid user)
        // Activity logs require a valid user_id, so we skip logging for system jobs
        
      } catch (error) {
        totalErrors++;
        console.error(`  ❌ Error syncing company ${integration.company_id}:`, error.message);
        
        // Skip error logging for system jobs (no valid user_id)
      }
    }
    
    const endTime = new Date();
    const duration = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2);
    
    console.log(`✅ HubSpot sync completed in ${duration}s`);
    console.log(`   - Total integrations: ${activeIntegrations.length}`);
    console.log(`   - Total deals synced: ${totalSynced}`);
    console.log(`   - Errors: ${totalErrors}`);
    
  } catch (error) {
    console.error('❌ Error in HubSpot sync job:', error);
  }
}

/**
 * Schedule the job to run daily at 2 AM
 */
export function scheduleCommissionRecalculation() {
  // Run every day at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    await runCommissionRecalculation();
  }, {
    scheduled: true,
    timezone: "UTC"
  });
  
  console.log('📅 Commission recalculation job scheduled to run daily at 2:00 AM UTC');
}

/**
 * Schedule HubSpot sync based on integration settings
 */
export function scheduleHubSpotSync() {
  // Check for active HubSpot integrations and their sync frequencies
  prisma.crm_integrations.findMany({
    where: {
      crm_type: 'hubspot',
      is_active: true
    }
  }).then(integrations => {
    if (integrations.length === 0) {
      console.log('📊 No active HubSpot integrations found for scheduling');
      return;
    }
    
    // Determine the most frequent sync requirement
    const frequencies = integrations.map(i => i.sync_frequency || 'daily');
    const hasHourly = frequencies.includes('hourly');
    const hasDaily = frequencies.includes('daily');
    
    if (hasHourly) {
      // Run every hour at minute 15
      cron.schedule('15 * * * *', async () => {
        await runHubSpotSync();
      }, {
        scheduled: true,
        timezone: "UTC"
      });
      console.log('🔄 HubSpot sync scheduled to run hourly at 15 minutes past the hour');
    } else if (hasDaily) {
      // Run daily at 3 AM UTC (1 hour after commission recalculation)
      cron.schedule('0 3 * * *', async () => {
        await runHubSpotSync();
      }, {
        scheduled: true,
        timezone: "UTC"
      });
      console.log('🔄 HubSpot sync scheduled to run daily at 3:00 AM UTC');
    }
  }).catch(error => {
    console.error('Error setting up HubSpot sync schedule:', error);
  });
}

// Export for manual execution
export default {
  runCommissionRecalculation,
  scheduleCommissionRecalculation,
  runHubSpotSync,
  scheduleHubSpotSync
};