import { PrismaClient } from '@prisma/client';
import { toDecimal, calculateCommission, toNumber, toString } from '../utils/money.js';

const prisma = new PrismaClient();

/**
 * Deal Commission Calculator Service
 * Calculates commission for deals based on active targets with period-level structures
 */
class DealCommissionCalculator {
  /**
   * Calculate commission for a single deal (triggers full period recalculation)
   * Only calculates if:
   * 1. Deal is closed_won
   * 2. An active target exists for the close date
   */
  async calculateDealCommission(dealId) {
    const deal = await prisma.deals.findUnique({
      where: { id: dealId }
    });

    if (!deal) {
      throw new Error('Deal not found');
    }

    // Only calculate for closed_won deals (handle case variations)
    const stage = deal.stage?.toLowerCase().replace(/[\s_-]/g, ''); // Normalize: remove spaces, underscores, hyphens
    if (stage !== 'closedwon') {
      console.log(`Deal ${dealId} is not closed won (stage: ${deal.stage}), skipping commission calculation`);
      return deal;
    }

    // When a deal is closed, recalculate the entire period
    // This ensures performance gates and structures are applied correctly across all deals
    return await this.recalculatePeriodCommissions(deal.user_id, deal.close_date, dealId);
  }

  /**
   * Recalculate commissions for all deals in a period
   * This is called when any deal in the period changes
   * Applies period-level performance gates, accelerators, and other structures
   */
  async recalculatePeriodCommissions(userId, dateInPeriod, dealId = null) {
    // Get the deal to check product category
    let deal = null;
    if (dealId) {
      deal = await prisma.deals.findUnique({
        where: { id: dealId },
        include: { product_category: true }
      });
    }

    // Find active targets that cover this date
    const matchingTargets = await prisma.targets.findMany({
      where: {
        user_id: userId,
        is_active: true,
        period_start: { lte: dateInPeriod },
        period_end: { gte: dateInPeriod }
      },
      include: {
        product_category: true
      },
      orderBy: [
        { quota_amount: 'desc' },
        { period_type: 'asc' },
        { created_at: 'desc' }
      ]
    });

    if (matchingTargets.length === 0) {
      console.log(`⚠️ No active targets found for user ${userId} at ${dateInPeriod}`);
      return null;
    }

    // Filter targets by product category
    let activeTarget = null;

    // If deal has a product category, only match targets with same category or no category filter
    if (deal && deal.product_category_id) {
      activeTarget = matchingTargets.find(
        t => !t.product_category_id || t.product_category_id === deal.product_category_id
      );
    } else {
      // Deal has no product category - only match targets with no category filter
      activeTarget = matchingTargets.find(t => !t.product_category_id);
    }

    // If no matching target found, provide detailed error
    if (!activeTarget) {
      if (deal && !deal.product_category_id && matchingTargets.every(t => t.product_category_id)) {
        const categories = matchingTargets.map(t => t.product_category?.name).filter(Boolean).join(', ');
        const errorMsg = `❌ Cannot calculate commission for deal "${deal.deal_name}": Deal has no product category assigned. Available targets require product categories: ${categories}. Please assign a product category to this deal.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      } else if (deal && deal.product_category_id) {
        const dealCategory = deal.product_category?.name;
        const categories = matchingTargets.map(t => t.product_category?.name).filter(Boolean).join(', ');
        const errorMsg = `❌ Cannot calculate commission for deal "${deal.deal_name}": Deal category "${dealCategory}" does not match any active target. Available target categories: ${categories}.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      console.log(`⚠️ No matching target found for date ${dateInPeriod}`);
      return null;
    }

    // Get all closed_won deals in this target's period
    const dealsInPeriod = await prisma.deals.findMany({
      where: {
        user_id: userId,
        stage: { in: ['closed_won', 'Closed Won', 'closedwon'] },
        close_date: {
          gte: activeTarget.period_start,
          lte: activeTarget.period_end
        }
      },
      orderBy: { close_date: 'asc' }
    });

    if (dealsInPeriod.length === 0) {
      console.log(`No deals found in period for target ${activeTarget.name}`);
      return null;
    }

    // Calculate period metrics
    const totalSales = dealsInPeriod.reduce((sum, deal) => sum + Number(deal.amount), 0);
    const quotaAmount = Number(activeTarget.quota_amount);
    const attainmentPercent = quotaAmount > 0 ? (totalSales / quotaAmount) * 100 : 0;

    console.log(`\n🔄 Recalculating commissions for period: ${activeTarget.name}`);
    console.log(`   Total sales: £${totalSales.toLocaleString()}`);
    console.log(`   Quota: £${quotaAmount.toLocaleString()}`);
    console.log(`   Attainment: ${attainmentPercent.toFixed(2)}%`);
    console.log(`   Deals in period: ${dealsInPeriod.length}`);

    // Evaluate performance gates (period-level check)
    const gateResults = this.evaluatePerformanceGates(
      activeTarget.performance_gates,
      attainmentPercent,
      totalSales,
      quotaAmount
    );

    // Check if any hard gates failed
    const hardGateFailed = gateResults.some(g => g.enforcement === 'hard' && !g.passed);

    // Calculate final commission rate (base rate + accelerators/decelerators)
    const finalRate = this.calculateFinalRate(
      activeTarget.commission_rate,
      activeTarget.commission_structure,
      attainmentPercent,
      hardGateFailed
    );

    console.log(`   Final commission rate: ${(finalRate * 100).toFixed(2)}%`);
    if (hardGateFailed) {
      console.log(`   ❌ Hard performance gate FAILED - zero commission applied`);
    }

    // Update all deals in the period with calculated commission
    const updates = [];
    for (const deal of dealsInPeriod) {
      const commissionAmount = hardGateFailed ? 0 : calculateCommission(deal.amount, finalRate);

      // Log calculation details
      console.log(`   ${deal.deal_name}: £${Number(deal.amount).toLocaleString()} → £${toString(commissionAmount)} commission`);
      if (hardGateFailed) {
        console.log(`      (Gate failed: zero commission applied)`);
      }

      updates.push(
        prisma.deals.update({
          where: { id: deal.id },
          data: {
            commission_rate: finalRate,
            commission_amount: toNumber(commissionAmount),
            commission_calculated_at: new Date(),
            target_id: activeTarget.id // Link deal to target
          }
        })
      );
    }

    // Execute all updates in transaction
    await prisma.$transaction(updates);

    console.log(`✅ Updated ${updates.length} deals in period\n`);

    return dealsInPeriod;
  }

  /**
   * Evaluate performance gates against period metrics
   * Returns array of gate results with pass/fail status
   */
  evaluatePerformanceGates(performanceGates, attainmentPercent, totalSales, quotaAmount) {
    if (!performanceGates?.gates || performanceGates.gates.length === 0) {
      return [];
    }

    return performanceGates.gates.map(gate => {
      let actualValue;
      let passed = false;

      // Get the actual value based on metric type
      switch (gate.metric) {
        case 'quota_attainment':
          actualValue = attainmentPercent;
          break;
        case 'total_sales':
          actualValue = totalSales;
          break;
        case 'quota_amount':
          actualValue = quotaAmount;
          break;
        default:
          actualValue = 0;
      }

      // Evaluate gate condition
      const threshold = Number(gate.value);
      switch (gate.operator) {
        case '>=':
          passed = actualValue >= threshold;
          break;
        case '>':
          passed = actualValue > threshold;
          break;
        case '<=':
          passed = actualValue <= threshold;
          break;
        case '<':
          passed = actualValue < threshold;
          break;
        case '==':
        case '===':
          passed = actualValue === threshold;
          break;
        default:
          passed = false;
      }

      // IMPORTANT: For gates with penalty_type "zero_commission",
      // passing the gate condition means FAILING the commission eligibility
      // Example: "quota_attainment <= 50%" means if you're below 50%, you FAIL (get zero commission)
      if (gate.penalty_type === 'zero_commission') {
        passed = !passed; // Invert the logic
      }

      return {
        name: gate.name,
        metric: gate.metric,
        operator: gate.operator,
        threshold: threshold,
        actualValue: actualValue,
        passed: passed,
        enforcement: gate.enforcement || 'soft',
        penalty_type: gate.penalty_type || 'percentage_reduction'
      };
    });
  }

  /**
   * Calculate final commission rate including accelerators/decelerators
   */
  calculateFinalRate(baseRate, commissionStructure, attainmentPercent, hardGateFailed) {
    const base = Number(baseRate);

    // If hard gate failed, rate is always 0
    if (hardGateFailed) {
      return 0;
    }

    // No structure, use base rate
    if (!commissionStructure || !commissionStructure.type) {
      return base;
    }

    switch (commissionStructure.type) {
      case 'accelerator':
        return this.applyAccelerator(base, commissionStructure.accelerators, attainmentPercent);

      case 'decelerator':
        return this.applyDecelerator(base, commissionStructure.decelerators, attainmentPercent);

      case 'tiered':
        // Tiered rates would need deal amount, so we can't apply here
        // Tiered rates should be calculated per-deal, not per-period
        return base;

      default:
        return base;
    }
  }

  /**
   * Apply accelerator multipliers based on quota attainment
   */
  applyAccelerator(baseRate, accelerators, attainmentPercent) {
    if (!accelerators || accelerators.length === 0) {
      return baseRate;
    }

    // Find the highest applicable accelerator
    // Accelerators are typically structured as: "at 100% quota, apply 1.5x multiplier"
    let applicableMultiplier = 1.0;

    for (const acc of accelerators) {
      const threshold = Number(acc.threshold);
      if (attainmentPercent >= threshold) {
        applicableMultiplier = Math.max(applicableMultiplier, Number(acc.multiplier));
      }
    }

    return baseRate * applicableMultiplier;
  }

  /**
   * Apply decelerator multipliers based on quota attainment
   */
  applyDecelerator(baseRate, decelerators, attainmentPercent) {
    if (!decelerators || decelerators.length === 0) {
      return baseRate;
    }

    // Find the applicable decelerator (penalty for being below threshold)
    // Decelerators are typically structured as: "below 80% quota, apply 0.5x multiplier"
    let applicableMultiplier = 1.0;

    for (const dec of decelerators) {
      const threshold = Number(dec.threshold);
      if (attainmentPercent < threshold) {
        applicableMultiplier = Math.min(applicableMultiplier, Number(dec.multiplier));
      }
    }

    return baseRate * applicableMultiplier;
  }

  /**
   * Recalculate commissions for all deals affected by a target
   * Used when a new target is created or updated
   */
  async recalculateForTarget(targetId) {
    const target = await prisma.targets.findUnique({
      where: { id: targetId }
    });

    if (!target || !target.is_active) {
      return { updated: 0 };
    }

    console.log(`🔄 Recalculating commissions for target: ${target.name}`);

    // Find all closed_won deals in this target's period
    const dealsToUpdate = await prisma.deals.findMany({
      where: {
        user_id: target.user_id,
        stage: { in: ['closed_won', 'Closed Won', 'closedwon'] },
        close_date: {
          gte: target.period_start,
          lte: target.period_end
        }
      }
    });

    if (dealsToUpdate.length > 0) {
      // Recalculate the entire period (this will update all deals)
      await this.recalculatePeriodCommissions(target.user_id, target.period_start);
    }

    return { updated: dealsToUpdate.length };
  }

  /**
   * Handle deal stage change
   * Calculate commission when deal moves to closed_won
   */
  async handleDealUpdate(dealId, oldStage, newStage) {
    // Only calculate when moving TO closed_won (handle case variations)
    const isOldClosed = oldStage?.toLowerCase().replace(/[\s_-]/g, '') === 'closedwon';
    const isNewClosed = newStage?.toLowerCase().replace(/[\s_-]/g, '') === 'closedwon';

    if (!isOldClosed && isNewClosed) {
      console.log(`🎯 Deal ${dealId} moved to closed_won, recalculating period commissions`);
      return await this.calculateDealCommission(dealId);
    }

    // If moving away from closed_won, recalculate the period to remove this deal's impact
    if (isOldClosed && !isNewClosed) {
      console.log(`⚠️ Deal ${dealId} moved from closed_won to ${newStage}`);
      const deal = await prisma.deals.findUnique({ where: { id: dealId } });

      // Clear commission on this deal
      await prisma.deals.update({
        where: { id: dealId },
        data: {
          commission_rate: null,
          commission_amount: null,
          commission_calculated_at: null
        }
      });

      // Recalculate remaining deals in the period
      if (deal && deal.close_date) {
        await this.recalculatePeriodCommissions(deal.user_id, deal.close_date);
      }
    }
  }

  /**
   * Get commission summary for a user/period
   * Replaces the old commission table queries
   */
  async getCommissionSummary(userId, periodStart, periodEnd) {
    const result = await prisma.deals.aggregate({
      where: {
        user_id: userId,
        stage: { in: ['closed_won', 'Closed Won', 'closedwon'] },
        close_date: {
          gte: periodStart,
          lte: periodEnd
        }
      },
      _sum: {
        amount: true,
        commission_amount: true
      },
      _count: {
        id: true
      }
    });

    // Count deals without commission
    const pendingCommission = await prisma.deals.count({
      where: {
        user_id: userId,
        stage: { in: ['closed_won', 'Closed Won', 'closedwon'] },
        close_date: {
          gte: periodStart,
          lte: periodEnd
        },
        commission_amount: null
      }
    });

    return {
      totalDeals: result._count.id || 0,
      totalSales: result._sum.amount || 0,
      totalCommission: result._sum.commission_amount || 0,
      dealsWithPendingCommission: pendingCommission
    };
  }
}

export default new DealCommissionCalculator();
