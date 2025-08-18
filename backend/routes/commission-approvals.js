// Commission Approval Workflow Routes
import express from 'express';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';
import { attachPermissions, requireManager, requireAdmin } from '../middleware/permissions.js';
import CommissionEngine from '../services/CommissionEngine.js';
import enhancedCommissionCalculator from '../services/enhancedCommissionCalculator.js';
import { Decimal } from 'decimal.js';

const router = express.Router();
const prisma = new PrismaClient();

// Attach permissions to all routes
router.use(attachPermissions);

// Validation schemas
const approvalActionSchema = Joi.object({
  action: Joi.string().valid('review', 'approve', 'reject', 'request_change', 'pay', 'adjust_and_approve').required(),
  notes: Joi.string().max(1000).allow('').optional(),
  payment_reference: Joi.string().when('action', {
    is: 'pay',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  adjustment_amount: Joi.number().when('action', {
    is: 'adjust_and_approve',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  adjustment_reason: Joi.string().when('action', {
    is: 'adjust_and_approve',
    then: Joi.string().min(10).max(500).required(),
    otherwise: Joi.optional()
  })
});

const bulkApprovalSchema = Joi.object({
  commission_ids: Joi.array().items(Joi.string()).min(1).required(),
  action: Joi.string().valid('approve', 'reject').required(),
  notes: Joi.string().max(1000).optional()
});

/**
 * GET /api/commission-approvals
 * Get commissions pending approval with filtering
 */
router.get('/', async (req, res) => {
  try {
    const { 
      status, 
      user_id, 
      period_start, 
      period_end,
      min_amount,
      max_amount,
      page = 1,
      limit = 20
    } = req.query;

    let where = {
      company_id: req.user.company_id
    };

    // Filter by status
    if (status) {
      where.status = status;
    } else {
      // Default to showing items needing action
      where.status = { in: ['calculated', 'pending_review'] };
    }

    // Filter by user (managers can see their team's commissions)
    if (user_id) {
      if (req.permissions.canManageTeam) {
        // Verify user is in manager's team
        const teamMember = await prisma.users.findFirst({
          where: {
            id: user_id,
            company_id: req.user.company_id,
            OR: [
              { manager_id: req.user.id },
              { id: req.user.id }
            ]
          }
        });

        if (!teamMember) {
          return res.status(403).json({ error: 'User not in your team' });
        }

        where.user_id = user_id;
      } else if (user_id === req.user.id) {
        where.user_id = req.user.id;
      } else {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else if (!req.permissions.canManageTeam) {
      // Non-managers can only see their own commissions
      where.user_id = req.user.id;
    }

    // Date range filter - check for period overlap
    if (period_start && period_end) {
      where.AND = [
        { period_start: { lte: new Date(period_end) } },
        { period_end: { gte: new Date(period_start) } }
      ];
    } else if (period_end && !period_start) {
      // For overdue filter - only deals closed before a certain date
      where.deal = {
        close_date: { lte: new Date(period_end) }
      };
    }

    // Amount range filter
    if (min_amount || max_amount) {
      where.commission_amount = {};
      if (min_amount) where.commission_amount.gte = parseFloat(min_amount);
      if (max_amount) where.commission_amount.lte = parseFloat(max_amount);
    }

    // Get commissions with related data
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
        },
        target: {
          select: {
            id: true,
            period_type: true,
            quota_amount: true
          }
        },
        approvals: {
          orderBy: { performed_at: 'desc' },
          take: 1,
          include: {
            performed_by_user: {
              select: {
                first_name: true,
                last_name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: [
        { status: 'asc' },
        { commission_amount: 'desc' },
        { calculated_at: 'desc' }
      ],
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    // Get total count for pagination
    const total = await prisma.commissions.count({ where });

    // Calculate summary statistics
    const stats = await prisma.commissions.aggregate({
      where,
      _sum: {
        commission_amount: true
      },
      _count: {
        id: true
      }
    });

    // Get status breakdown
    const statusBreakdown = await prisma.commissions.groupBy({
      by: ['status'],
      where: {
        company_id: req.user.company_id,
        ...(where.user_id && { user_id: where.user_id })
      },
      _count: {
        id: true
      },
      _sum: {
        commission_amount: true
      }
    });

    res.json({
      commissions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      summary: {
        total_count: stats._count.id || 0,
        total_amount: stats._sum.commission_amount || 0,
        status_breakdown: statusBreakdown.map(s => ({
          status: s.status,
          count: s._count.id,
          amount: s._sum.commission_amount || 0
        }))
      }
    });

  } catch (error) {
    console.error('Get commission approvals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/commission-approvals/:id
 * Get single commission with full details and history
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const commission = await prisma.commissions.findUnique({
      where: { id },
      include: {
        deal: true,
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            manager: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true
              }
            }
          }
        },
        target: true,
        company: {
          select: {
            id: true,
            name: true
          }
        },
        approvals: {
          include: {
            performed_by_user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true
              }
            }
          },
          orderBy: { performed_at: 'asc' }
        }
      }
    });

    if (!commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    // Check access permissions
    const canAccess = 
      commission.user_id === req.user.id ||
      (req.permissions.canManageTeam && commission.company_id === req.user.company_id);

    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Parse notes if they contain rule information
    let appliedRules = [];
    if (commission.notes) {
      try {
        const notesData = JSON.parse(commission.notes);
        appliedRules = notesData.applied_rules || [];
      } catch (e) {
        // Notes might not be JSON
      }
    }

    res.json({
      commission,
      applied_rules: appliedRules,
      can_approve: req.permissions.canManageTeam,
      can_pay: req.permissions.isAdmin
    });

  } catch (error) {
    console.error('Get commission details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/commission-approvals/:id/action
 * Process approval action on a commission
 */
router.post('/:id/action', requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = approvalActionSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { action, notes, payment_reference, adjustment_amount, adjustment_reason } = value;

    // Get commission
    const commission = await prisma.commissions.findUnique({
      where: { id },
      include: {
        deal: true,
        user: true
      }
    });

    if (!commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    // Check permissions based on action
    if (action === 'pay' && !req.permissions.isAdmin) {
      return res.status(403).json({ error: 'Only administrators can mark commissions as paid' });
    }

    // Validate workflow rules
    const validTransitions = {
      'calculated': ['review', 'approve', 'reject', 'adjust_and_approve'],
      'pending_review': ['approve', 'reject', 'request_change', 'adjust_and_approve'],
      'approved': ['pay', 'reject'],
      'rejected': ['review'],
      'paid': []
    };

    // Special handling for adjust_and_approve
    const effectiveAction = action === 'adjust_and_approve' ? 'approve' : action;

    if (action !== 'adjust_and_approve' && !validTransitions[commission.status]?.includes(action)) {
      return res.status(400).json({ 
        error: `Cannot ${action} commission in ${commission.status} status` 
      });
    } else if (action === 'adjust_and_approve' && !validTransitions[commission.status]?.includes('adjust_and_approve')) {
      return res.status(400).json({ 
        error: `Cannot adjust and approve commission in ${commission.status} status` 
      });
    }

    // Handle adjustment if provided (for adjust_and_approve action)
    let finalAmount = commission.commission_amount;
    let wasAdjusted = false;
    
    if (action === 'adjust_and_approve') {
      // For adjust_and_approve, adjustment_amount is the NEW total, not a delta
      finalAmount = new Decimal(adjustment_amount).toNumber();
      wasAdjusted = true;

      if (finalAmount < 0) {
        return res.status(400).json({ error: 'Adjusted amount cannot be negative' });
      }
      
      // Store the original amount for audit trail
      await prisma.commissions.update({
        where: { id },
        data: {
          original_amount: commission.commission_amount,
          commission_amount: finalAmount,
          adjustment_reason,
          adjusted_by: req.user.id,
          adjusted_at: new Date()
        }
      });
    }

    // Process the action (use 'approve' for adjust_and_approve)
    const updatedCommission = await CommissionEngine.processApproval(
      id,
      effectiveAction,
      req.user.id,
      wasAdjusted ? `Adjusted and approved: ${adjustment_reason}` : (notes || payment_reference)
    );

    // Send notifications (implement based on your notification system)
    if (action === 'approve') {
      // Notify user their commission was approved
      console.log(`Commission approved for ${commission.user.email}: £${finalAmount}`);
    } else if (action === 'reject') {
      // Notify user their commission was rejected
      console.log(`Commission rejected for ${commission.user.email}: ${notes}`);
    }

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: `commission_${action}`,
        entity_type: 'commission',
        entity_id: id,
        after_state: { 
          status: updatedCommission.status,
          amount: finalAmount
        },
        context: {
          deal_id: commission.deal_id,
          notes,
          adjustment_amount,
          adjustment_reason
        },
        success: true
      }
    });

    res.json({
      success: true,
      commission: updatedCommission,
      message: `Commission ${action} successful`
    });

  } catch (error) {
    console.error('Process commission action error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/commission-approvals/bulk-action
 * Process bulk approval actions
 */
router.post('/bulk-action', requireManager, async (req, res) => {
  try {
    const { error, value } = bulkApprovalSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { commission_ids, action, notes } = value;

    // Verify all commissions exist and user has access
    const commissions = await prisma.commissions.findMany({
      where: {
        id: { in: commission_ids },
        company_id: req.user.company_id,
        status: { in: ['calculated', 'pending_review'] }
      }
    });

    if (commissions.length !== commission_ids.length) {
      return res.status(400).json({ 
        error: 'Some commissions not found or not eligible for bulk action' 
      });
    }

    // Process each commission
    const results = [];
    const errors = [];

    for (const commission of commissions) {
      try {
        const updated = await CommissionEngine.processApproval(
          commission.id,
          action,
          req.user.id,
          notes
        );
        results.push({
          id: commission.id,
          success: true,
          status: updated.status
        });
      } catch (error) {
        errors.push({
          id: commission.id,
          success: false,
          error: error.message
        });
      }
    }

    // Log bulk activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: `commission_bulk_${action}`,
        entity_type: 'commission',
        entity_id: 'bulk',
        context: {
          commission_ids,
          successful: results.length,
          failed: errors.length,
          notes
        },
        success: errors.length === 0
      }
    });

    res.json({
      success: errors.length === 0,
      processed: results.length,
      results,
      errors,
      message: `Processed ${results.length} commissions, ${errors.length} errors`
    });

  } catch (error) {
    console.error('Bulk approval error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/commission-approvals/pending-count
 * Get count of pending approvals for current user
 */
router.get('/pending-count', async (req, res) => {
  try {
    let where = {
      company_id: req.user.company_id,
      status: { in: ['calculated', 'pending_review'] }
    };

    // Managers see their team's pending approvals
    if (req.permissions.canManageTeam) {
      const teamMembers = await prisma.users.findMany({
        where: {
          manager_id: req.user.id,
          company_id: req.user.company_id,
          is_active: true
        },
        select: { id: true }
      });

      const teamIds = teamMembers.map(m => m.id);
      teamIds.push(req.user.id);
      
      where.user_id = { in: teamIds };
    } else {
      // Regular users don't see pending approvals
      return res.json({ count: 0 });
    }

    const count = await prisma.commissions.count({ where });

    res.json({ 
      count,
      requires_action: count > 0
    });

  } catch (error) {
    console.error('Get pending count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/commission-approvals/recalculate/:id
 * Recalculate commission for a deal
 */
router.post('/recalculate/:id', requireManager, async (req, res) => {
  try {
    const { id } = req.params;

    const commission = await prisma.commissions.findUnique({
      where: { id },
      include: { deal: true }
    });

    if (!commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    if (commission.status === 'paid') {
      return res.status(400).json({ error: 'Cannot recalculate paid commissions' });
    }

    // Recalculate using enhanced calculator
    const result = await enhancedCommissionCalculator.calculateDealCommission(
      commission.deal_id,
      { 
        recalculate: true,
        createAuditRecord: false,
        useAdvancedRules: true
      }
    );

    // Get the new commission amount from the deal (since it was updated)
    const updatedDeal = await prisma.deals.findUnique({
      where: { id: commission.deal_id }
    });

    const newCommissionAmount = updatedDeal.commission_amount || commission.commission_amount;
    const appliedRules = result.calculation?.applied_rules || [];

    // Update existing commission record
    const updatedCommission = await prisma.commissions.update({
      where: { id },
      data: {
        commission_amount: newCommissionAmount,
        commission_rate: updatedDeal.commission_rate || commission.commission_rate,
        status: 'calculated',
        calculated_at: new Date(),
        calculated_by: req.user.id,
        notes: JSON.stringify({
          applied_rules: appliedRules,
          recalculated_by: req.user.email,
          recalculated_at: new Date()
        })
      }
    });

    // Create audit record
    await prisma.commission_approvals.create({
      data: {
        commission_id: id,
        action: 'recalculate',
        performed_by: req.user.id,
        notes: 'Manual recalculation requested',
        previous_status: commission.status,
        new_status: 'calculated',
        metadata: {
          old_amount: commission.commission_amount,
          new_amount: newCommissionAmount,
          applied_rules: appliedRules
        }
      }
    });

    res.json({
      success: true,
      commission: updatedCommission,
      calculation: result.calculation || { 
        total_commission: newCommissionAmount,
        applied_rules: appliedRules 
      }
    });

  } catch (error) {
    console.error('Recalculate commission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/commission-approvals/migrate
 * Migrate historical commission data to new system
 */
router.post('/migrate', requireAdmin, async (req, res) => {
  try {
    const { batch_size = 100 } = req.body;

    const result = await enhancedCommissionCalculator.migrateExistingCommissions({
      batchSize: batch_size,
      companyId: req.user.company_id
    });

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;