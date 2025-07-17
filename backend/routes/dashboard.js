// routes/dashboard.js
import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Get dashboard data for current user
router.get('/sales-rep', async (req, res) => {
  try {
    res.json({
      user: req.user,
      current_target: null,
      metrics: {
        quota_attainment: 0,
        closed_amount: 0,
        commission_earned: 0,
        projected_commission: 0,
        trend: 'stable'
      },
      quota_progress: {
        closed_amount: 0,
        commit_amount: 0,
        best_case_amount: 0,
        total_quota: 0,
        commission_rate: 0
      },
      deals: {
        closed: [],
        commit: [],
        best_case: [],
        pipeline: []
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dashboard data for specific user (managers/admins only)
router.get('/sales-rep/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Verify user can access this data
    if (userId !== req.user.id && req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const currentDate = new Date();
    const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

    // Get current sales target
    const currentTarget = await prisma.sales_targets.findFirst({
      where: {
        user_id: userId,
        period_start: { lte: currentDate },
        period_end: { gte: currentDate },
        is_active: true
      }
    });

    if (!currentTarget) {
      return res.status(404).json({ error: 'No active sales target found' });
    }

    // Get deals by category
    const deals = await prisma.deals.findMany({
      where: {
        user_id: userId,
        close_date: {
          gte: currentTarget.period_start,
          lte: currentTarget.period_end
        }
      },
      orderBy: { amount: 'desc' }
    });

    const closedDeals = deals.filter(d => d.status === 'closed_won');
    const commitDeals = deals.filter(d => d.deal_type === 'commit');
    const bestCaseDeals = deals.filter(d => d.deal_type === 'best_case');
    const pipelineDeals = deals.filter(d => d.deal_type === 'pipeline');

    // Calculate totals
    const closedAmount = closedDeals.reduce((sum, deal) => sum + Number(deal.amount), 0);
    const commitAmount = commitDeals.reduce((sum, deal) => sum + Number(deal.amount), 0);
    const bestCaseAmount = bestCaseDeals.reduce((sum, deal) => sum + Number(deal.amount), 0);

    const quotaAttainment = (closedAmount / Number(currentTarget.target_amount)) * 100;
    const projectedAttainment = ((closedAmount + commitAmount + bestCaseAmount) / Number(currentTarget.target_amount)) * 100;

    // Calculate commissions
    const earnedCommission = closedAmount * Number(currentTarget.commission_rate);
    const projectedCommission = (closedAmount + commitAmount + bestCaseAmount) * Number(currentTarget.commission_rate);

    const dashboardData = {
      target: {
        amount: Number(currentTarget.target_amount),
        period_start: currentTarget.period_start,
        period_end: currentTarget.period_end,
        commission_rate: Number(currentTarget.commission_rate)
      },
      performance: {
        closed_amount: closedAmount,
        quota_attainment: quotaAttainment,
        projected_attainment: projectedAttainment,
        earned_commission: earnedCommission,
        projected_commission: projectedCommission
      },
      deals: {
        closed: closedDeals,
        commit: commitDeals,
        best_case: bestCaseDeals,
        pipeline: pipelineDeals
      },
      summary: {
        total_deals: deals.length,
        closed_deals: closedDeals.length,
        commit_deals: commitDeals.length,
        best_case_deals: bestCaseDeals.length,
        pipeline_deals: pipelineDeals.length
      }
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update deal category (for drag & drop)
router.patch('/deals/:dealId/category', async (req, res) => {
  try {
    const { dealId } = req.params;
    const { deal_type } = req.body;

    const validTypes = ['closed', 'commit', 'best_case', 'pipeline'];
    if (!validTypes.includes(deal_type)) {
      return res.status(400).json({ error: 'Invalid deal type' });
    }

    const deal = await prisma.deals.findUnique({
      where: { id: dealId }
    });

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    if (deal.user_id !== req.user.id && req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedDeal = await prisma.deals.update({
      where: { id: dealId },
      data: { deal_type }
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        action: 'deal_category_updated',
        entity_type: 'deal',
        entity_id: dealId,
        details: { 
          old_type: deal.deal_type,
          new_type: deal_type 
        }
      }
    });

    res.json(updatedDeal);
  } catch (error) {
    console.error('Deal category update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;