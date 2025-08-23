// Commission Reporting and Audit Trail Routes
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { attachPermissions } from '../middleware/permissions.js';
import { Decimal } from 'decimal.js';

const router = express.Router();
const prisma = new PrismaClient();

// Attach permissions to all routes
router.use(attachPermissions);

/**
 * GET /api/commission-reports/audit-trail
 * Get complete audit trail for commissions
 */
router.get('/audit-trail', async (req, res) => {
  try {
    const { 
      user_id,
      deal_id,
      commission_id,
      start_date,
      end_date,
      action,
      page = 1,
      limit = 50
    } = req.query;

    let where = {};

    // Filter by commission
    if (commission_id) {
      where.commission_id = commission_id;
    }

    // Filter by user (through commission relationship)
    if (user_id) {
      // Check permissions
      if (user_id !== req.user.id && !req.permissions.canManageTeam) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      where.commission = {
        user_id
      };
    }

    // Filter by deal
    if (deal_id) {
      where.commission = {
        ...where.commission,
        deal_id
      };
    }

    // Filter by action
    if (action) {
      where.action = action;
    }

    // Date range filter
    if (start_date || end_date) {
      where.performed_at = {};
      if (start_date) where.performed_at.gte = new Date(start_date);
      if (end_date) where.performed_at.lte = new Date(end_date);
    }

    // Company filter for non-specific queries
    if (!commission_id && !user_id && !deal_id) {
      where.commission = {
        company_id: req.user.company_id
      };
    }

    const approvals = await prisma.commission_approvals.findMany({
      where,
      include: {
        commission: {
          include: {
            deal: {
              select: {
                id: true,
                deal_name: true,
                account_name: true,
                amount: true
              }
            },
            user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true
              }
            }
          }
        },
        performed_by_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      },
      orderBy: { performed_at: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    const total = await prisma.commission_approvals.count({ where });

    res.json({
      audit_trail: approvals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get audit trail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/commission-reports/summary
 * Get commission summary report
 */
router.get('/summary', async (req, res) => {
  try {
    const { 
      period = 'monthly',
      year = new Date().getFullYear(),
      quarter,
      month,
      user_id,
      team_view = false
    } = req.query;

    let dateRange = {};
    const currentYear = parseInt(year);

    // Determine date range based on period
    if (period === 'yearly') {
      dateRange = {
        gte: new Date(Date.UTC(currentYear, 0, 1)),
        lte: new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59))
      };
    } else if (period === 'quarterly' && quarter) {
      const q = parseInt(quarter) - 1;
      dateRange = {
        gte: new Date(Date.UTC(currentYear, q * 3, 1)),
        lte: new Date(Date.UTC(currentYear, q * 3 + 3, 0, 23, 59, 59))
      };
    } else if (period === 'monthly' && month) {
      const m = parseInt(month) - 1;
      dateRange = {
        gte: new Date(Date.UTC(currentYear, m, 1)),
        lte: new Date(Date.UTC(currentYear, m + 1, 0, 23, 59, 59))
      };
    } else {
      // Default to current month
      const now = new Date();
      dateRange = {
        gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        lte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59))
      };
    }

    let where = {
      company_id: req.user.company_id,
      period_start: { gte: dateRange.gte },
      period_end: { lte: dateRange.lte }
    };

    // Handle user/team filtering
    let userIds = [req.user.id];
    
    if (team_view && req.permissions.canManageTeam) {
      // Get team members
      const teamMembers = await prisma.users.findMany({
        where: {
          manager_id: req.user.id,
          company_id: req.user.company_id,
          is_active: true
        },
        select: { id: true }
      });
      userIds = [...userIds, ...teamMembers.map(m => m.id)];
    } else if (user_id && req.permissions.canManageTeam) {
      userIds = [user_id];
    } else if (user_id && user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    where.user_id = { in: userIds };

    // Get commission summary by status
    const commissionsByStatus = await prisma.commissions.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true
      },
      _sum: {
        commission_amount: true,
        adjustment_amount: true
      }
    });

    // Get detailed commissions
    const commissions = await prisma.commissions.findMany({
      where,
      include: {
        deal: {
          select: {
            id: true,
            deal_name: true,
            account_name: true,
            amount: true,
            close_date: true
          }
        },
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      },
      orderBy: { calculated_at: 'desc' }
    });

    // Calculate totals
    const totals = commissionsByStatus.reduce((acc, item) => {
      const amount = item._sum.commission_amount || 0;
      const adjustment = item._sum.adjustment_amount || 0;
      
      acc.total_commission += Number(amount);
      acc.total_adjustment += Number(adjustment);
      acc[`${item.status}_amount`] = Number(amount) + Number(adjustment);
      acc[`${item.status}_count`] = item._count.id;
      
      return acc;
    }, {
      total_commission: 0,
      total_adjustment: 0,
      calculated_amount: 0,
      calculated_count: 0,
      pending_review_amount: 0,
      pending_review_count: 0,
      approved_amount: 0,
      approved_count: 0,
      paid_amount: 0,
      paid_count: 0,
      rejected_amount: 0,
      rejected_count: 0
    });

    // Get user breakdown if team view
    let userBreakdown = null;
    if (team_view && req.permissions.canManageTeam) {
      userBreakdown = await prisma.commissions.groupBy({
        by: ['user_id'],
        where,
        _sum: {
          commission_amount: true,
          adjustment_amount: true
        },
        _count: {
          id: true
        }
      });

      // Enhance with user details
      const userDetails = await prisma.users.findMany({
        where: {
          id: { in: userBreakdown.map(u => u.user_id) }
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true
        }
      });

      userBreakdown = userBreakdown.map(item => {
        const user = userDetails.find(u => u.id === item.user_id);
        return {
          user,
          total_commission: Number(item._sum.commission_amount || 0) + Number(item._sum.adjustment_amount || 0),
          deal_count: item._count.id
        };
      });
    }

    res.json({
      period: {
        type: period,
        start: dateRange.gte,
        end: dateRange.lte
      },
      summary: totals,
      status_breakdown: commissionsByStatus,
      user_breakdown: userBreakdown,
      commissions: commissions.slice(0, 10), // Return top 10 for preview
      total_records: commissions.length
    });

  } catch (error) {
    console.error('Get commission summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/commission-reports/payment-ready
 * Get commissions ready for payment
 */
router.get('/payment-ready', async (req, res) => {
  try {
    if (!req.permissions.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { 
      payment_period_start,
      payment_period_end
    } = req.query;

    let where = {
      company_id: req.user.company_id,
      status: 'approved'
    };

    if (payment_period_start && payment_period_end) {
      where.approved_at = {
        gte: new Date(payment_period_start),
        lte: new Date(payment_period_end)
      };
    }

    // Get approved commissions grouped by user
    const commissionsByUser = await prisma.commissions.groupBy({
      by: ['user_id'],
      where,
      _sum: {
        commission_amount: true,
        adjustment_amount: true
      },
      _count: {
        id: true
      }
    });

    // Get user details and calculate net amounts
    const paymentSummary = await Promise.all(
      commissionsByUser.map(async (item) => {
        const user = await prisma.users.findUnique({
          where: { id: item.user_id },
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        });

        const grossAmount = new Decimal(item._sum.commission_amount || 0);
        const adjustments = new Decimal(item._sum.adjustment_amount || 0);
        const netAmount = grossAmount.plus(adjustments);

        // Get commission IDs for this user
        const commissions = await prisma.commissions.findMany({
          where: {
            ...where,
            user_id: item.user_id
          },
          select: { id: true }
        });

        return {
          user,
          gross_amount: grossAmount.toFixed(2),
          adjustments: adjustments.toFixed(2),
          net_amount: netAmount.toFixed(2),
          commission_count: item._count.id,
          commission_ids: commissions.map(c => c.id)
        };
      })
    );

    // Calculate totals
    const totals = paymentSummary.reduce((acc, item) => {
      acc.total_gross = new Decimal(acc.total_gross).plus(item.gross_amount).toFixed(2);
      acc.total_adjustments = new Decimal(acc.total_adjustments).plus(item.adjustments).toFixed(2);
      acc.total_net = new Decimal(acc.total_net).plus(item.net_amount).toFixed(2);
      acc.total_users++;
      acc.total_commissions += item.commission_count;
      return acc;
    }, {
      total_gross: '0',
      total_adjustments: '0',
      total_net: '0',
      total_users: 0,
      total_commissions: 0
    });

    res.json({
      payment_summary: paymentSummary,
      totals,
      payment_period: {
        start: payment_period_start || 'all time',
        end: payment_period_end || 'current'
      }
    });

  } catch (error) {
    console.error('Get payment ready error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/commission-reports/mark-paid
 * Mark multiple commissions as paid
 */
router.post('/mark-paid', async (req, res) => {
  try {
    if (!req.permissions.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { 
      commission_ids,
      payment_reference,
      payment_date = new Date()
    } = req.body;

    if (!commission_ids || commission_ids.length === 0) {
      return res.status(400).json({ error: 'Commission IDs required' });
    }

    if (!payment_reference) {
      return res.status(400).json({ error: 'Payment reference required' });
    }

    // Update all commissions to paid
    const updated = await prisma.commissions.updateMany({
      where: {
        id: { in: commission_ids },
        company_id: req.user.company_id,
        status: 'approved'
      },
      data: {
        status: 'paid',
        paid_at: new Date(payment_date),
        payment_reference
      }
    });

    // Create approval records for each
    const approvalRecords = commission_ids.map(id => ({
      commission_id: id,
      action: 'pay',
      performed_by: req.user.id,
      performed_at: new Date(),
      notes: payment_reference,
      previous_status: 'approved',
      new_status: 'paid',
      metadata: {
        payment_batch: true,
        payment_date
      }
    }));

    await prisma.commission_approvals.createMany({
      data: approvalRecords
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'commission_batch_payment',
        entity_type: 'commission',
        entity_id: 'batch',
        context: {
          commission_ids,
          payment_reference,
          payment_date,
          count: updated.count
        },
        success: true
      }
    });

    res.json({
      success: true,
      updated_count: updated.count,
      payment_reference,
      message: `Successfully marked ${updated.count} commissions as paid`
    });

  } catch (error) {
    console.error('Mark paid error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/commission-reports/export
 * Export commission data
 */
router.get('/export', async (req, res) => {
  try {
    const { 
      format = 'csv',
      start_date,
      end_date,
      status,
      user_id
    } = req.query;

    let where = {
      company_id: req.user.company_id
    };

    // Date range
    if (start_date && end_date) {
      where.period_start = { gte: new Date(start_date) };
      where.period_end = { lte: new Date(end_date) };
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    // User filter
    if (user_id) {
      if (user_id !== req.user.id && !req.permissions.canManageTeam) {
        return res.status(403).json({ error: 'Access denied' });
      }
      where.user_id = user_id;
    } else if (!req.permissions.canManageTeam) {
      where.user_id = req.user.id;
    }

    const commissions = await prisma.commissions.findMany({
      where,
      include: {
        deal: true,
        user: {
          select: {
            first_name: true,
            last_name: true,
            email: true
          }
        }
      },
      orderBy: { calculated_at: 'desc' }
    });

    if (format === 'csv') {
      const headers = [
        'Commission ID',
        'Deal Name',
        'Account',
        'Sales Rep',
        'Deal Amount',
        'Commission Rate',
        'Commission Amount',
        'Adjustments',
        'Net Amount',
        'Status',
        'Period Start',
        'Period End',
        'Calculated Date',
        'Approved Date',
        'Paid Date',
        'Payment Reference'
      ];

      const rows = commissions.map(c => {
        const netAmount = new Decimal(c.commission_amount)
          .plus(c.adjustment_amount || 0)
          .toFixed(2);

        return [
          c.id,
          c.deal.deal_name,
          c.deal.account_name,
          `${c.user.first_name} ${c.user.last_name}`,
          c.deal_amount,
          (c.commission_rate * 100).toFixed(2) + '%',
          c.commission_amount,
          c.adjustment_amount || 0,
          netAmount,
          c.status,
          new Date(c.period_start).toLocaleDateString(),
          new Date(c.period_end).toLocaleDateString(),
          c.calculated_at ? new Date(c.calculated_at).toLocaleDateString() : '',
          c.approved_at ? new Date(c.approved_at).toLocaleDateString() : '',
          c.paid_at ? new Date(c.paid_at).toLocaleDateString() : '',
          c.payment_reference || ''
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="commissions-${Date.now()}.csv"`);
      res.send(csvContent);
    } else {
      res.status(400).json({ error: 'Unsupported format' });
    }

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;