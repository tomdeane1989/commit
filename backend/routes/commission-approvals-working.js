// Working version - only import enhancedCommissionCalculator (which includes CommissionEngine)
import express from 'express';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';
import { attachPermissions, requireManager, requireAdmin } from '../middleware/permissions.js';
import { Decimal } from 'decimal.js';

// Only import enhancedCommissionCalculator since it already imports CommissionEngine internally
import enhancedCommissionCalculator from '../services/enhancedCommissionCalculator.js';

// Get CommissionEngine from the calculator's import
const CommissionEngine = enhancedCommissionCalculator.CommissionEngine || { 
  processApproval: async () => { throw new Error('CommissionEngine not available'); }
};

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
    // Return empty data structure that frontend expects
    res.json({
      commissions: [],
      pagination: {
        page: parseInt(req.query.page || '1'),
        limit: parseInt(req.query.limit || '20'),
        total: 0,
        pages: 0
      },
      summary: {
        total_count: 0,
        total_amount: 0,
        status_breakdown: []
      }
    });
  } catch (error) {
    console.error('Get commission approvals error:', error);
    res.status(500).json({ error: 'Commission approval feature not yet fully implemented' });
  }
});

/**
 * GET /api/commission-approvals/:id
 * Get single commission with full details and history
 */
router.get('/:id', async (req, res) => {
  try {
    return res.status(404).json({ error: 'Commission approval feature not yet implemented' });
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
    return res.json({
      success: true,
      message: 'Commission approval feature not yet implemented'
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
    return res.json({ count: 0, requires_action: false });
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
    return res.status(501).json({ 
      error: 'Recalculation feature not yet implemented' 
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