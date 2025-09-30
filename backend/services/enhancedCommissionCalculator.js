import { PrismaClient } from '@prisma/client';
import CommissionEngine from './CommissionEngine.js';
import { Decimal } from 'decimal.js';
import notificationService from './notificationService.js';

const prisma = new PrismaClient();

/**
 * Enhanced Commission Calculator
 * Bridges the existing commission system with the new audit trail system
 * Maintains backward compatibility while adding new features
 */
class EnhancedCommissionCalculator {
  /**
   * Calculate commission for a deal when it closes
   * Creates both legacy commission fields and new audit records
   */
  async calculateDealCommission(dealId, options = {}) {
    const { createAuditRecord = true, useAdvancedRules = false } = options;
    
    const deal = await prisma.deals.findUnique({
      where: { id: dealId },
      include: {
        user: true,
        company: true
      }
    });

    if (!deal) {
      throw new Error('Deal not found');
    }

    // Only calculate for closed_won deals
    if (deal.stage?.toLowerCase() !== 'closed won' && deal.stage?.toLowerCase() !== 'closed_won') {
      console.log(`Deal ${dealId} is not closed won (stage: ${deal.stage}), skipping commission calculation`);
      return deal;
    }

    // Check if commission already exists in new system
    const existingCommission = await prisma.commissions.findUnique({
      where: { deal_id: dealId }
    });

    if (existingCommission && !options.recalculate) {
      console.log(`Commission already exists for deal ${dealId}`);
      return { deal, commission: existingCommission };
    }

    // Find active target for this deal
    const activeTarget = await this.findActiveTarget(deal);

    let calculationResult;
    let commissionAmount = new Decimal(0);
    let commissionRate = new Decimal(0);

    if (useAdvancedRules) {
      // Use new rule engine for calculation
      const rules = await this.getApplicableRules(deal);
      
      if (rules.length > 0) {
        // Get context for calculation
        const context = await this.buildCalculationContext(deal, activeTarget);
        
        // Calculate using rule engine
        calculationResult = await CommissionEngine.calculateCommission(deal, rules, context);
        commissionAmount = new Decimal(calculationResult.total_commission);
        
        // Get effective rate for display
        if (deal.amount > 0) {
          commissionRate = commissionAmount.div(new Decimal(deal.amount));
        }
      } else if (activeTarget) {
        // Fall back to simple calculation if no rules
        commissionRate = new Decimal(activeTarget.commission_rate);
        commissionAmount = new Decimal(deal.amount).mul(commissionRate);
        
        calculationResult = {
          total_commission: commissionAmount.toFixed(2),
          applied_rules: [{
            rule_name: 'Default Target Rate',
            commission_amount: commissionAmount.toFixed(2)
          }],
          calculation_timestamp: new Date()
        };
      }
    } else {
      // Use simple calculation (backward compatible)
      if (activeTarget) {
        commissionRate = new Decimal(activeTarget.commission_rate);
        commissionAmount = new Decimal(deal.amount).mul(commissionRate);
        
        calculationResult = {
          total_commission: commissionAmount.toFixed(2),
          applied_rules: [{
            rule_name: 'Default Target Rate',
            commission_amount: commissionAmount.toFixed(2)
          }],
          calculation_timestamp: new Date()
        };
      }
    }

    // Update deal with commission (maintains backward compatibility)
    const updatedDeal = await prisma.deals.update({
      where: { id: dealId },
      data: {
        commission_rate: commissionRate.toNumber(),
        commission_amount: commissionAmount.toNumber(),
        commission_calculated_at: new Date()
      }
    });

    // Create audit record if enabled
    let commissionRecord = null;
    if (createAuditRecord && calculationResult) {
      // Pass the updated deal with fresh data
      commissionRecord = await CommissionEngine.createCommissionRecord(
        updatedDeal,
        calculationResult,
        activeTarget
      );

      // Auto-approve small commissions (configurable)
      const wasAutoApproved = commissionAmount.lte(1000) && deal.company.subscription !== 'trial';
      if (wasAutoApproved) {
        await CommissionEngine.processApproval(
          commissionRecord.id,
          'approve',
          'system',
          'Auto-approved: Below threshold'
        );
      }

      // Notify managers about new commission requiring approval (unless auto-approved)
      if (!wasAutoApproved) {
        try {
          const managers = await prisma.users.findMany({
            where: {
              company_id: deal.company_id,
              OR: [{ is_manager: true }, { is_admin: true }]
            },
            select: { id: true }
          });

          if (managers.length > 0) {
            await notificationService.notifyCommissionPendingApproval({
              commission: commissionRecord,
              deal: {
                ...updatedDeal,
                user: deal.user
              },
              targetManagers: managers.map(m => m.id),
              company_id: deal.company_id
            });
          }
        } catch (notifError) {
          console.error('Failed to send commission pending notification:', notifError);
          // Don't fail the commission calculation if notification fails
        }
      }
    }

    console.log(`💰 Calculated commission for deal ${deal.deal_name}: £${deal.amount} × ${commissionRate.toFixed(4)} = £${commissionAmount.toFixed(2)}`);

    return {
      deal: updatedDeal,
      commission: commissionRecord,
      calculation: calculationResult
    };
  }

  /**
   * Find active target for a deal
   */
  async findActiveTarget(deal) {
    return await prisma.targets.findFirst({
      where: {
        user_id: deal.user_id,
        is_active: true,
        period_start: { lte: deal.close_date },
        period_end: { gte: deal.close_date }
      },
      orderBy: [
        { parent_target_id: 'desc' }, // Prefer child targets
        { created_at: 'desc' }
      ]
    });
  }

  /**
   * Get applicable commission rules for a deal
   */
  async getApplicableRules(deal) {
    const rules = await prisma.commission_rules.findMany({
      where: {
        company_id: deal.company_id,
        is_active: true,
        effective_from: { lte: deal.close_date },
        OR: [
          { effective_to: null },
          { effective_to: { gte: deal.close_date } }
        ]
      },
      include: {
        tiers: true
      }
    });

    // Convert tiers to config format for compatibility
    return rules.map(rule => ({
      ...rule,
      config: {
        ...rule.config,
        tiers: rule.tiers.map(tier => ({
          threshold_min: tier.threshold_min,
          threshold_max: tier.threshold_max,
          rate: tier.rate,
          type: tier.type
        }))
      }
    }));
  }

  /**
   * Build calculation context for rule engine
   */
  async buildCalculationContext(deal, target) {
    // Get user's total sales for the period
    const periodStart = target?.period_start || new Date(deal.close_date.getFullYear(), 0, 1);
    const periodEnd = target?.period_end || new Date(deal.close_date.getFullYear(), 11, 31);

    const userSalesResult = await prisma.deals.aggregate({
      where: {
        user_id: deal.user_id,
        stage: { in: ['closed_won', 'Closed Won'] },
        close_date: {
          gte: periodStart,
          lte: periodEnd
        },
        id: { not: deal.id } // Exclude current deal
      },
      _sum: {
        amount: true
      }
    });

    const userSalesTotal = userSalesResult._sum.amount || 0;

    // Calculate attainment percentage
    let attainmentPercentage = 0;
    if (target && target.quota_amount > 0) {
      attainmentPercentage = (Number(userSalesTotal) / Number(target.quota_amount)) * 100;
    }

    return {
      user: deal.user,
      company: deal.company,
      period: {
        start: periodStart,
        end: periodEnd
      },
      userSalesTotal: Number(userSalesTotal),
      attainmentPercentage,
      target
    };
  }

  /**
   * Recalculate all commissions for a user/period
   */
  async recalculateForTarget(targetId) {
    const target = await prisma.targets.findUnique({
      where: { id: targetId }
    });

    if (!target || !target.is_active) {
      return { updated: 0 };
    }

    // Find all closed_won deals in this target's period
    const dealsToUpdate = await prisma.deals.findMany({
      where: {
        user_id: target.user_id,
        stage: { in: ['closed_won', 'Closed Won'] },
        close_date: {
          gte: target.period_start,
          lte: target.period_end
        }
      }
    });

    console.log(`🔄 Found ${dealsToUpdate.length} deals to recalculate for target ${targetId}`);

    let updated = 0;
    for (const deal of dealsToUpdate) {
      await this.calculateDealCommission(deal.id, { recalculate: true });
      updated++;
    }

    return { updated };
  }

  /**
   * Handle deal stage change
   */
  async handleDealUpdate(dealId, oldStage, newStage) {
    const isOldClosed = oldStage?.toLowerCase() === 'closed won' || oldStage?.toLowerCase() === 'closed_won';
    const isNewClosed = newStage?.toLowerCase() === 'closed won' || newStage?.toLowerCase() === 'closed_won';
    
    if (!isOldClosed && isNewClosed) {
      // Deal moved to closed_won - calculate commission
      console.log(`🎯 Deal ${dealId} moved to closed_won, calculating commission`);
      return await this.calculateDealCommission(dealId);
    }
    
    if (isOldClosed && !isNewClosed) {
      // Deal moved away from closed_won - void commission
      console.log(`⚠️ Deal ${dealId} moved from closed_won to ${newStage}, voiding commission`);
      
      // Clear commission on deal
      const updatedDeal = await prisma.deals.update({
        where: { id: dealId },
        data: {
          commission_rate: null,
          commission_amount: null,
          commission_calculated_at: null
        }
      });
      
      // Update commission record if exists
      const commission = await prisma.commissions.findUnique({
        where: { deal_id: dealId }
      });
      
      if (commission && commission.status !== 'paid') {
        await prisma.commissions.update({
          where: { id: commission.id },
          data: {
            status: 'voided',
            notes: `Deal stage changed from ${oldStage} to ${newStage}`
          }
        });
        
        // Create audit record
        await prisma.commission_approvals.create({
          data: {
            commission_id: commission.id,
            action: 'void',
            performed_by: 'system',
            notes: `Deal stage changed to ${newStage}`,
            previous_status: commission.status,
            new_status: 'voided'
          }
        });
      }
      
      return updatedDeal;
    }
  }

  /**
   * Migrate existing commission data to new audit system
   */
  async migrateExistingCommissions(options = {}) {
    const { batchSize = 100, companyId = null } = options;
    
    let where = {
      stage: { in: ['closed_won', 'Closed Won'] },
      commission_amount: { not: null }
    };
    
    if (companyId) {
      where.company_id = companyId;
    }
    
    // Get deals with commission that don't have audit records
    const deals = await prisma.deals.findMany({
      where,
      include: {
        user: true,
        company: true,
        commission: true
      },
      take: batchSize
    });
    
    const dealsToMigrate = deals.filter(d => !d.commission);
    
    console.log(`📊 Found ${dealsToMigrate.length} deals to migrate`);
    
    let migrated = 0;
    for (const deal of dealsToMigrate) {
      try {
        // Find the target that was active when deal closed
        const target = await this.findActiveTarget(deal);
        
        // Create commission record
        const commission = await prisma.commissions.create({
          data: {
            deal_id: deal.id,
            user_id: deal.user_id,
            company_id: deal.company_id,
            deal_amount: deal.amount,
            commission_rate: deal.commission_rate || 0,
            commission_amount: deal.commission_amount || 0,
            target_id: target?.id,
            target_name: target ? `${target.period_type} - ${target.period_start}` : 'Historical',
            period_start: target?.period_start || deal.close_date,
            period_end: target?.period_end || deal.close_date,
            status: 'approved', // Historical data assumed approved
            calculated_at: deal.commission_calculated_at || deal.updated_at,
            approved_at: deal.commission_calculated_at || deal.updated_at,
            approved_by: 'migration',
            notes: 'Migrated from legacy commission data'
          }
        });
        
        // Create audit record
        await prisma.commission_approvals.create({
          data: {
            commission_id: commission.id,
            action: 'migrated',
            performed_by: 'system',
            notes: 'Migrated from legacy commission system',
            previous_status: 'legacy',
            new_status: 'approved',
            metadata: {
              migration_date: new Date(),
              original_calculation_date: deal.commission_calculated_at
            }
          }
        });
        
        migrated++;
      } catch (error) {
        console.error(`Failed to migrate deal ${deal.id}:`, error.message);
      }
    }
    
    console.log(`✅ Successfully migrated ${migrated} commission records`);
    
    return {
      total: dealsToMigrate.length,
      migrated,
      failed: dealsToMigrate.length - migrated
    };
  }
}

const calculator = new EnhancedCommissionCalculator();
calculator.CommissionEngine = CommissionEngine; // Expose CommissionEngine for commission-approvals route
export default calculator;