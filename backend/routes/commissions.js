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

    // Find active target for the period
    const target = await prisma.targets.findFirst({
      where: {
        user_id: targetUserId,
        period_start: { lte: new Date(period_end) },
        period_end: { gte: new Date(period_start) },
        is_active: true
      }
    });

    if (!target) {
      return res.status(404).json({ error: 'No active target found for this period' });
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
    const totalCommissionEarned = totalClosedAmount * Number(target.commission_rate);
    const quotaAttainmentPercentage = (totalClosedAmount / Number(target.quota_amount)) * 100;

    // Create or update commission record
    let commission = await prisma.commissions.findFirst({
      where: {
        user_id: targetUserId,
        target_id: target.id,
        period_start: new Date(period_start),
        period_end: new Date(period_end)
      }
    });

    if (commission) {
      // Update existing commission
      commission = await prisma.commissions.update({
        where: { id: commission.id },
        data: {
          actual_amount: totalClosedAmount,
          commission_earned: totalCommissionEarned,
          attainment_pct: quotaAttainmentPercentage,
          quota_amount: Number(target.quota_amount),
          commission_rate: Number(target.commission_rate),
          base_commission: totalCommissionEarned,
          calculated_at: new Date()
        }
      });
    } else {
      // Create new commission
      commission = await prisma.commissions.create({
        data: {
          user_id: targetUserId,
          target_id: target.id,
          company_id: req.user.company_id,
          period_start: new Date(period_start),
          period_end: new Date(period_end),
          quota_amount: Number(target.quota_amount),
          actual_amount: totalClosedAmount,
          attainment_pct: quotaAttainmentPercentage,
          commission_rate: Number(target.commission_rate),
          commission_earned: totalCommissionEarned,
          base_commission: totalCommissionEarned
        }
      });
    }

    // Delete existing deal commission details and create new ones
    await prisma.commission_details.deleteMany({
      where: { commission_id: commission.id }
    });

    const dealCommissions = await Promise.all(
      closedDeals.map(deal => 
        prisma.commission_details.create({
          data: {
            deal_id: deal.id,
            commission_id: commission.id,
            commission_amount: Number(deal.amount) * Number(target.commission_rate)
          }
        })
      )
    );

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'commission_calculated',
        entity_type: 'commission',
        entity_id: commission.id,
        context: {
          period_start,
          period_end,
          total_commission_earned: totalCommissionEarned,
          quota_attainment_percentage: quotaAttainmentPercentage
        },
        success: true
      }
    });

    res.json({
      commission: commission,
      deal_commissions: dealCommissions,
      summary: {
        closed_deals_count: closedDeals.length,
        total_closed_amount: totalClosedAmount,
        total_commission_earned: totalCommissionEarned,
        quota_attainment_percentage: quotaAttainmentPercentage,
        commission_rate: Number(target.commission_rate)
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
    const { user_id, status, include_historical } = req.query;

    const targetUserId = user_id || req.user.id;

    // Check permissions
    if (targetUserId !== req.user.id && req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const where = {
      user_id: targetUserId,
      ...(status && { status })
    };

    // Get user's active target to determine payment schedule
    const activeTarget = await prisma.targets.findFirst({
      where: {
        user_id: targetUserId,
        is_active: true
      }
    });

    const commissions = await prisma.commissions.findMany({
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
        target: {
          select: {
            id: true,
            commission_payment_schedule: true,
            period_type: true,
            quota_amount: true,
            commission_rate: true
          }
        },
        commission_details: {
          include: {
            deal: {
              select: {
                id: true,
                deal_name: true,
                account_name: true,
                amount: true,
                close_date: true,
                closed_date: true
              }
            }
          }
        }
      },
      orderBy: { period_start: 'desc' }
    });

    // If historical data is requested, calculate missing periods
    if (include_historical === 'true' && activeTarget) {
      const paymentSchedule = activeTarget.commission_payment_schedule || 'monthly';
      const periodsToGenerate = paymentSchedule === 'quarterly' ? 4 : 12;
      
      // Generate period suggestions for periods without commissions
      const suggestions = [];
      const now = new Date();
      
      for (let i = 0; i < periodsToGenerate; i++) {
        let periodStart, periodEnd, periodLabel;
        
        if (paymentSchedule === 'quarterly') {
          const quarterDate = new Date(now.getFullYear(), now.getMonth() - (i * 3), 1);
          const year = quarterDate.getFullYear();
          const quarter = Math.floor(quarterDate.getMonth() / 3);
          const quarterStartMonth = quarter * 3;
          
          periodStart = new Date(year, quarterStartMonth, 1);
          periodEnd = new Date(year, quarterStartMonth + 3, 0);
          periodLabel = `Q${quarter + 1} ${year}`;
        } else {
          const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const year = monthDate.getFullYear();
          const month = monthDate.getMonth();
          
          periodStart = new Date(year, month, 1);
          periodEnd = new Date(year, month + 1, 0);
          periodLabel = monthDate.toLocaleDateString('en-GB', { 
            month: 'long', 
            year: 'numeric' 
          });
        }
        
        // Check if commission exists for this period
        const existingCommission = commissions.find(c => {
          const commissionStart = new Date(c.period_start);
          return commissionStart.getTime() === periodStart.getTime();
        });
        
        if (!existingCommission && periodEnd < now) {
          suggestions.push({
            period_start: periodStart.toISOString().split('T')[0],
            period_end: periodEnd.toISOString().split('T')[0],
            label: periodLabel,
            can_calculate: true
          });
        }
      }
      
      return res.json({
        commissions,
        payment_schedule: paymentSchedule,
        missing_periods: suggestions
      });
    }

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

    const commission = await prisma.commissions.findUnique({
      where: { id }
    });

    if (!commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    const updatedCommission = await prisma.commissions.update({
      where: { id },
      data: { status: 'approved' }
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'commission_approved',
        entity_type: 'commission',
        entity_id: id,
        context: {},
        success: true
      }
    });

    res.json(updatedCommission);
  } catch (error) {
    console.error('Approve commission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;