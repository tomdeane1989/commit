import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Commission Calculator Service
 * Handles automatic commission calculation when deals change
 */
class CommissionCalculator {
  /**
   * Calculate commission for a single deal
   */
  async calculateDealCommission(deal, target) {
    if (!target) return 0;
    return Number(deal.amount) * Number(target.commission_rate);
  }

  /**
   * Get the active target for a user at a specific date
   * Prefers period-specific targets (quarterly/monthly) over annual targets
   */
  async getActiveTargetForDate(userId, date, preferredPeriodType = null) {
    // First try to find a period-specific target (quarterly or monthly)
    const targets = await prisma.targets.findMany({
      where: {
        user_id: userId,
        is_active: true,
        period_start: { lte: date },
        period_end: { gte: date }
      },
      orderBy: [
        { period_type: 'asc' }, // This will prioritize 'monthly' and 'quarterly' over 'annual'
        { created_at: 'desc' }
      ]
    });
    
    if (targets.length === 0) return null;
    
    // If we have a preferred period type, try to find it
    if (preferredPeriodType) {
      const preferredTarget = targets.find(t => t.period_type === preferredPeriodType);
      if (preferredTarget) return preferredTarget;
    }
    
    // Otherwise, prefer quarterly/monthly over annual
    const nonAnnualTarget = targets.find(t => t.period_type !== 'annual');
    if (nonAnnualTarget) return nonAnnualTarget;
    
    // Fall back to annual if that's all we have
    return targets[0];
  }

  /**
   * Get period boundaries based on payment schedule
   */
  getPeriodForDate(date, paymentSchedule = 'monthly') {
    const d = new Date(date);
    let start, end;

    if (paymentSchedule === 'monthly') {
      start = new Date(d.getFullYear(), d.getMonth(), 1);
      end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    } else if (paymentSchedule === 'quarterly') {
      const quarter = Math.floor(d.getMonth() / 3);
      start = new Date(d.getFullYear(), quarter * 3, 1);
      end = new Date(d.getFullYear(), quarter * 3 + 3, 0);
    } else { // annual
      start = new Date(d.getFullYear(), 0, 1);
      end = new Date(d.getFullYear(), 11, 31);
    }

    return { start, end };
  }

  /**
   * Handle deal changes and trigger commission recalculation
   */
  async handleDealChange(deal, previousDeal = null, triggerType = 'manual') {
    console.log(`🔄 Commission Calculator: Processing deal ${deal.id} (${triggerType})`);

    const isNewDeal = !previousDeal;
    const statusChanged = previousDeal?.status !== deal.status;
    const amountChanged = previousDeal?.amount !== deal.amount;
    const closeDateChanged = previousDeal?.close_date !== deal.close_date;
    const categoryChanged = previousDeal?.category !== deal.category;

    // Check if we need to recalculate
    if (!isNewDeal && !statusChanged && !amountChanged && !closeDateChanged && !categoryChanged) {
      console.log('ℹ️ No relevant changes detected, skipping commission calculation');
      return;
    }

    // Get target for the deal's close date - prefer quarterly targets for quarterly periods
    const dealDate = new Date(deal.close_date);
    const quarter = Math.floor(dealDate.getMonth() / 3);
    const isQuarterlyPeriod = quarter >= 0; // Always true, but we'll use this to determine preference
    
    const target = await this.getActiveTargetForDate(
      deal.user_id, 
      deal.close_date,
      'quarterly' // Prefer quarterly targets
    );
    
    if (!target) {
      console.log(`⚠️ No active target found for user ${deal.user_id} at ${deal.close_date}`);
      return;
    }

    // Calculate commission amounts
    const commission = await this.calculateDealCommission(deal, target);
    
    // Update deal with commission amounts
    await prisma.deals.update({
      where: { id: deal.id },
      data: {
        projected_commission: deal.status !== 'closed_won' ? commission : 0,
        actual_commission: deal.status === 'closed_won' ? commission : 0
      }
    });

    console.log(`💰 Deal commission updated: ${deal.status === 'closed_won' ? 'actual' : 'projected'} = £${commission}`);

    // Trigger period recalculation
    const period = this.getPeriodForDate(deal.close_date, target.commission_payment_schedule);
    
    if (deal.status === 'closed_won') {
      await this.updateActualCommissions(deal.user_id, period, target, triggerType);
    }
    
    // Always update projected commissions
    await this.updateProjectedCommissions(deal.user_id, period, target, triggerType);

    // If previous deal had a different period, recalculate that too
    if (previousDeal && closeDateChanged) {
      const oldPeriod = this.getPeriodForDate(previousDeal.close_date, target.commission_payment_schedule);
      if (oldPeriod.start.getTime() !== period.start.getTime()) {
        console.log('📅 Deal moved periods, recalculating old period');
        await this.updateActualCommissions(deal.user_id, oldPeriod, target, triggerType);
        await this.updateProjectedCommissions(deal.user_id, oldPeriod, target, triggerType);
      }
    }
  }

  /**
   * Update actual commissions for a user/period
   */
  async updateActualCommissions(userId, period, target, trigger = 'manual') {
    console.log(`📊 Updating actual commissions for user ${userId} in period ${period.start.toISOString().split('T')[0]} to ${period.end.toISOString().split('T')[0]}`);

    const closedDeals = await prisma.deals.findMany({
      where: {
        user_id: userId,
        status: 'closed_won',
        close_date: {
          gte: period.start,
          lte: period.end
        }
      }
    });

    const totalAmount = closedDeals.reduce((sum, deal) => sum + Number(deal.amount), 0);
    const totalCommission = totalAmount * Number(target.commission_rate);
    const attainment = (totalAmount / Number(target.quota_amount)) * 100;

    // Upsert actual commission record
    const commission = await prisma.commissions.upsert({
      where: {
        user_id_period_start_period_end_commission_type: {
          user_id: userId,
          period_start: period.start,
          period_end: period.end,
          commission_type: 'actual'
        }
      },
      create: {
        user_id: userId,
        target_id: target.id,
        company_id: target.company_id,
        period_start: period.start,
        period_end: period.end,
        commission_type: 'actual',
        quota_amount: target.quota_amount,
        actual_amount: totalAmount,
        commission_earned: totalCommission,
        base_commission: totalCommission,
        attainment_pct: attainment,
        commission_rate: target.commission_rate,
        status: 'calculated',
        calculation_trigger: trigger,
        last_calculated_at: new Date()
      },
      update: {
        actual_amount: totalAmount,
        commission_earned: totalCommission,
        base_commission: totalCommission,
        attainment_pct: attainment,
        last_calculated_at: new Date(),
        calculation_trigger: trigger
      }
    });

    // Update commission details for deals
    await prisma.commission_details.deleteMany({
      where: { commission_id: commission.id }
    });

    for (const deal of closedDeals) {
      await prisma.commission_details.create({
        data: {
          commission_id: commission.id,
          deal_id: deal.id,
          commission_amount: Number(deal.amount) * Number(target.commission_rate)
        }
      });
    }

    console.log(`✅ Actual commission updated: £${totalCommission} (${attainment.toFixed(1)}% attainment)`);
  }

  /**
   * Update projected commissions for a user/period
   */
  async updateProjectedCommissions(userId, period, target, trigger = 'manual') {
    console.log(`🔮 Updating projected commissions for user ${userId} in period ${period.start.toISOString().split('T')[0]} to ${period.end.toISOString().split('T')[0]}`);

    // Get all open deals in the period
    const openDeals = await prisma.deals.findMany({
      where: {
        user_id: userId,
        status: { in: ['pipeline', 'commit', 'best_case', 'open'] },
        close_date: {
          gte: period.start,
          lte: period.end
        }
      },
      include: {
        deal_categorizations: {
          orderBy: { created_at: 'desc' },
          take: 1
        }
      }
    });

    // Calculate weighted projections based on deal category
    const weights = {
      pipeline: 0.1,    // 10% probability
      commit: 0.75,     // 75% probability
      best_case: 0.25,  // 25% probability
      open: 0.1         // Default 10% for uncategorized
    };

    let weightedAmount = 0;
    let projectedByCategory = {
      pipeline: 0,
      commit: 0,
      best_case: 0,
      open: 0
    };

    for (const deal of openDeals) {
      // Use categorization if available, otherwise use status
      const category = deal.deal_categorizations[0]?.category || deal.status || 'open';
      const weight = weights[category] || 0.1;
      const dealAmount = Number(deal.amount);
      
      projectedByCategory[category] += dealAmount;
      weightedAmount += dealAmount * weight;
    }

    const projectedCommission = weightedAmount * Number(target.commission_rate);
    
    // Get actual amount for combined attainment
    const actualCommission = await prisma.commissions.findFirst({
      where: {
        user_id: userId,
        period_start: period.start,
        period_end: period.end,
        commission_type: 'actual'
      }
    });

    const actualAmount = actualCommission ? Number(actualCommission.actual_amount) : 0;
    const combinedAttainment = ((actualAmount + weightedAmount) / Number(target.quota_amount)) * 100;

    // Upsert projected commission record
    const commission = await prisma.commissions.upsert({
      where: {
        user_id_period_start_period_end_commission_type: {
          user_id: userId,
          period_start: period.start,
          period_end: period.end,
          commission_type: 'projected'
        }
      },
      create: {
        user_id: userId,
        target_id: target.id,
        company_id: target.company_id,
        period_start: period.start,
        period_end: period.end,
        commission_type: 'projected',
        quota_amount: target.quota_amount,
        actual_amount: weightedAmount,
        commission_earned: projectedCommission,
        base_commission: projectedCommission,
        attainment_pct: combinedAttainment,
        commission_rate: target.commission_rate,
        status: 'calculated',
        calculation_trigger: trigger,
        last_calculated_at: new Date(),
        ai_insights: {
          breakdown: projectedByCategory,
          deal_count: openDeals.length,
          weights_used: weights
        }
      },
      update: {
        actual_amount: weightedAmount,
        commission_earned: projectedCommission,
        base_commission: projectedCommission,
        attainment_pct: combinedAttainment,
        last_calculated_at: new Date(),
        calculation_trigger: trigger,
        ai_insights: {
          breakdown: projectedByCategory,
          deal_count: openDeals.length,
          weights_used: weights
        }
      }
    });

    console.log(`✅ Projected commission updated: £${projectedCommission.toFixed(2)} (weighted from ${openDeals.length} open deals)`);
    console.log(`   Pipeline: £${projectedByCategory.pipeline}, Commit: £${projectedByCategory.commit}, Best Case: £${projectedByCategory.best_case}`);
  }

  /**
   * Batch recalculate commissions for multiple deals
   */
  async batchRecalculate(deals, trigger = 'sync') {
    console.log(`🔄 Batch recalculating commissions for ${deals.length} deals`);
    
    // Group deals by user and period
    const userPeriods = new Map();
    
    for (const deal of deals) {
      const target = await this.getActiveTargetForDate(deal.user_id, deal.close_date);
      if (!target) continue;
      
      const period = this.getPeriodForDate(deal.close_date, target.commission_payment_schedule);
      const key = `${deal.user_id}-${period.start.getTime()}-${period.end.getTime()}`;
      
      if (!userPeriods.has(key)) {
        userPeriods.set(key, {
          userId: deal.user_id,
          period,
          target,
          deals: []
        });
      }
      
      userPeriods.get(key).deals.push(deal);
    }
    
    // Recalculate each unique user/period combination
    for (const { userId, period, target } of userPeriods.values()) {
      await this.updateActualCommissions(userId, period, target, trigger);
      await this.updateProjectedCommissions(userId, period, target, trigger);
    }
    
    console.log(`✅ Batch recalculation complete for ${userPeriods.size} user/period combinations`);
  }
}

export default new CommissionCalculator();