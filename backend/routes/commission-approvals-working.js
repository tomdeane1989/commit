// Working version - only import enhancedCommissionCalculator (which includes CommissionEngine)
import express from 'express';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';
import { attachPermissions, requireManager, requireAdmin } from '../middleware/permissions.js';
import { Decimal } from 'decimal.js';

// Only import enhancedCommissionCalculator since it already imports CommissionEngine internally
import enhancedCommissionCalculator from '../services/enhancedCommissionCalculator.js';

// Get CommissionEngine from the calculator's import
const CommissionEngine = enhancedCommissionCalculator.CommissionEngine;

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
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '20');
    const skip = (page - 1) * limit;
    
    // Build filter conditions
    let where = {
      company_id: req.user.company_id
    };
    
    // Filter by status
    if (req.query.status) {
      where.status = req.query.status;
    } else {
      // Default to pending approvals
      where.status = { in: ['calculated', 'pending_review'] };
    }
    
    // Filter by user (for managers to see their team)
    if (req.query.user_id) {
      where.user_id = req.query.user_id;
    } else if (req.permissions.canManageTeam) {
      // Managers see their team's commissions
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
      // Regular users only see their own
      where.user_id = req.user.id;
    }
    
    // Get commissions with pagination
    const [commissions, total] = await Promise.all([
      prisma.commissions.findMany({
        where,
        skip,
        take: limit,
        include: {
          deal: true,
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          },
          target: true
        },
        orderBy: { created_at: 'desc' }
      }),
      prisma.commissions.count({ where })
    ]);
    
    // Calculate summary statistics
    const summary = await prisma.commissions.aggregate({
      where,
      _sum: {
        commission_amount: true
      },
      _count: true
    });
    
    // Get status breakdown
    const statusBreakdown = await prisma.commissions.groupBy({
      by: ['status'],
      where: {
        company_id: req.user.company_id,
        user_id: where.user_id
      },
      _count: true,
      _sum: {
        commission_amount: true
      }
    });
    
    res.json({
      commissions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      summary: {
        total_count: summary._count,
        total_amount: summary._sum.commission_amount || 0,
        status_breakdown: statusBreakdown.map(s => ({
          status: s.status,
          count: s._count,
          amount: s._sum.commission_amount || 0
        }))
      }
    });
  } catch (error) {
    console.error('Get commission approvals error:', error);
    res.status(500).json({ error: 'Failed to retrieve commissions' });
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

    // Map action to status
    const actionToStatus = {
      'review': 'pending_review',
      'approve': 'approved',
      'reject': 'rejected',
      'request_change': 'pending_review',
      'pay': 'paid'
    };

    // Update commission status
    const updatedCommission = await prisma.commissions.update({
      where: { id },
      data: {
        status: actionToStatus[effectiveAction],
        [`${effectiveAction === 'pay' ? 'paid' : effectiveAction === 'approve' ? 'approved' : effectiveAction === 'review' ? 'reviewed' : 'updated'}_at`]: new Date(),
        [`${effectiveAction === 'pay' ? 'payment_reference' : effectiveAction === 'approve' ? 'approved_by' : effectiveAction === 'review' ? 'reviewed_by' : 'updated_at'}`]: effectiveAction === 'pay' ? payment_reference : effectiveAction === 'review' || effectiveAction === 'approve' ? req.user.id : new Date()
      }
    });

    // Create approval record
    await prisma.commission_approvals.create({
      data: {
        commission_id: id,
        action,
        performed_by: req.user.id,
        notes: wasAdjusted ? `Adjusted and approved: ${adjustment_reason}` : (notes || payment_reference),
        previous_status: commission.status,
        new_status: updatedCommission.status,
        metadata: wasAdjusted ? {
          original_amount: commission.commission_amount,
          adjusted_amount: finalAmount,
          adjustment_reason
        } : null
      }
    });

    // Send notifications (implement based on your notification system)
    if (action === 'approve' || action === 'adjust_and_approve') {
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
    return res.status(501).json({ 
      error: 'Bulk approval feature not yet implemented' 
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
      return res.json({ count: 0, requires_action: false });
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
    return res.status(501).json({ 
      error: 'Migration feature not yet implemented' 
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;