import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Deal Commission Calculator Service
 * Calculates commission for deals based on active targets
 */
class DealCommissionCalculator {
  /**
   * Calculate commission for a single deal
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
    if (deal.stage?.toLowerCase() !== 'closed won' && deal.stage?.toLowerCase() !== 'closed_won') {
      console.log(`Deal ${dealId} is not closed won (stage: ${deal.stage}), skipping commission calculation`);
      return deal;
    }

    // Find active target that covers this deal's close date
    const activeTarget = await prisma.targets.findFirst({
      where: {
        user_id: deal.user_id,
        is_active: true,
        period_start: { lte: deal.close_date },
        period_end: { gte: deal.close_date }
      },
      orderBy: [
        { period_type: 'asc' }, // Prefer quarterly/monthly over annual
        { created_at: 'desc' }  // Most recent if multiple
      ]
    });

    if (activeTarget) {
      // Calculate and store commission
      const commissionAmount = Number(deal.amount) * Number(activeTarget.commission_rate);
      
      console.log(`💰 Calculating commission for deal ${deal.deal_name}: £${deal.amount} × ${activeTarget.commission_rate} = £${commissionAmount.toFixed(2)}`);
      
      return await prisma.deals.update({
        where: { id: dealId },
        data: {
          commission_rate: activeTarget.commission_rate,
          commission_amount: commissionAmount,
          commission_calculated_at: new Date()
        }
      });
    } else {
      console.log(`⚠️ No active target found for deal ${deal.deal_name} (close date: ${deal.close_date})`);
      
      // Clear any existing commission if no target
      if (deal.commission_amount !== null) {
        return await prisma.deals.update({
          where: { id: dealId },
          data: {
            commission_rate: null,
            commission_amount: null,
            commission_calculated_at: null
          }
        });
      }
    }

    return deal;
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

    // Find all closed_won deals in this target's period without commission
    const dealsToUpdate = await prisma.deals.findMany({
      where: {
        user_id: target.user_id,
        stage: { in: ['closed_won', 'Closed Won'] },
        close_date: {
          gte: target.period_start,
          lte: target.period_end
        },
        commission_amount: null // Not yet calculated
      }
    });

    console.log(`🔄 Found ${dealsToUpdate.length} deals to calculate commission for target ${targetId}`);

    let updated = 0;
    for (const deal of dealsToUpdate) {
      await this.calculateDealCommission(deal.id);
      updated++;
    }

    return { updated };
  }

  /**
   * Handle deal stage change
   * Calculate commission when deal moves to closed_won
   */
  async handleDealUpdate(dealId, oldStage, newStage) {
    // Only calculate when moving TO closed_won (handle case variations)
    const isOldClosed = oldStage?.toLowerCase() === 'closed won' || oldStage?.toLowerCase() === 'closed_won';
    const isNewClosed = newStage?.toLowerCase() === 'closed won' || newStage?.toLowerCase() === 'closed_won';
    
    if (!isOldClosed && isNewClosed) {
      console.log(`🎯 Deal ${dealId} moved to closed_won, calculating commission`);
      return await this.calculateDealCommission(dealId);
    }
    
    // If moving away from closed_won, clear commission
    if (isOldClosed && !isNewClosed) {
      console.log(`⚠️ Deal ${dealId} moved from closed_won to ${newStage}, clearing commission`);
      return await prisma.deals.update({
        where: { id: dealId },
        data: {
          commission_rate: null,
          commission_amount: null,
          commission_calculated_at: null
        }
      });
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
        stage: { in: ['closed_won', 'Closed Won'] },
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
        stage: { in: ['closed_won', 'Closed Won'] },
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