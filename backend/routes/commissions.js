// routes/commissions.js
import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Calculate commission for a period
router.post('/calculate', async (req, res) => {
  try {
    const { user_id, period_start, period_end } = req.body;

    const targetUserId = user_id || req.user.id;

    // Check permissions
    if (targetUserId !== req.user.id && req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Find active sales target for the period
    const salesTarget = await prisma.sales_targets.findFirst({
      where: {
        user_id: targetUserId,
        period_start: { lte: new Date(period_end) },
        period_end: { gte: new Date(period_start) },
        is_active: true
      }
    });

    if (!salesTarget) {
      return res.status(404).json({ error: 'No active sales target found for this period' });
    }

    // Get closed deals for the period
    const closedDeals = await prisma.deals.findMany({
      where: {
        user_id: targetUserId,
        status: 'closed_won',
        close_date: {
          gte: new Date(period_start),
          lte: new Date(period_end)
        }
      }
    });

    // Calculate totals
    const totalClosedAmount = closedDeals.reduce((sum, deal) => sum + Number(deal.amount), 0);
    const totalCommissionEarned = totalClosedAmount * Number(salesTarget.commission_rate);
    const quotaAttainmentPercentage = (totalClosedAmount / Number(salesTarget.target_amount)) * 100;

    // Create or update commission calculation
    let commissionCalculation = await prisma.commission_calculations.findFirst({
      where: {
        user_id: targetUserId,
        sales_target_id: salesTarget.id,
        calculation_period_start: new Date(period_start),
        calculation_period_end: new Date(period_end)
      }
    });

    if (commissionCalculation) {
      // Update existing calculation
      commissionCalculation = await prisma.commission_calculations.update({
        where: { id: commissionCalculation.id },
        data: {
          total_closed_amount: totalClosedAmount,
          total_commission_earned: totalCommissionEarned,
          quota_attainment_percentage: quotaAttainmentPercentage,
          calculated_at: new Date()
        }
      });
    } else {
      // Create new calculation
      commissionCalculation = await prisma.commission_calculations.create({
        data: {
          user_id: targetUserId,
          sales_target_id: salesTarget.id,
          calculation_period_start: new Date(period_start),
          calculation_period_end: new Date(period_end),
          total_closed_amount: totalClosedAmount,
          total_commission_earned: totalCommissionEarned,
          quota_attainment_percentage: quotaAttainmentPercentage
        }
      });
    }

    // Delete existing deal commissions and create new ones
    await prisma.deal_commissions.deleteMany({
      where: { commission_calculation_id: commissionCalculation.id }
    });

    const dealCommissions = await Promise.all(
      closedDeals.map(deal => 
        prisma.deal_commissions.create({
          data: {
            deal_id: deal.id,
            commission_calculation_id: commissionCalculation.id,
            commission_amount: Number(deal.amount) * Number(salesTarget.commission_rate),
            commission_rate: Number(salesTarget.commission_rate)
          }
        })
      )
    );

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        action: 'commission_calculated',
        entity_type: 'commission',
        entity_id: commissionCalculation.id,
        details: {
          period_start,
          period_end,
          total_commission_earned: totalCommissionEarned,
          quota_attainment_percentage: quotaAttainmentPercentage
        }
      }
    });

    res.json({
      commission_calculation: commissionCalculation,
      deal_commissions: dealCommissions,
      summary: {
        closed_deals_count: closedDeals.length,
        total_closed_amount: totalClosedAmount,
        total_commission_earned: totalCommissionEarned,
        quota_attainment_percentage: quotaAttainmentPercentage,
        commission_rate: Number(salesTarget.commission_rate)
      }
    });
  } catch (error) {
    console.error('Calculate commission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get commission calculations
router.get('/', async (req, res) => {
  try {
    const { user_id, status } = req.query;

    const targetUserId = user_id || req.user.id;

    // Check permissions
    if (targetUserId !== req.user.id && req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const where = {
      user_id: targetUserId,
      ...(status && { status })
    };

    const commissions = await prisma.commission_calculations.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        },
        sales_target: true,
        deal_commissions: {
          include: {
            deal: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json(commissions);
  } catch (error) {
    console.error('Get commissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve commission calculation
router.patch('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    // Only managers and admins can approve
    if (req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const commission = await prisma.commission_calculations.findUnique({
      where: { id }
    });

    if (!commission) {
      return res.status(404).json({ error: 'Commission calculation not found' });
    }

    const updatedCommission = await prisma.commission_calculations.update({
      where: { id },
      data: { status: 'approved' }
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        action: 'commission_approved',
        entity_type: 'commission',
        entity_id: id,
        details: {}
      }
    });

    res.json(updatedCommission);
  } catch (error) {
    console.error('Approve commission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;