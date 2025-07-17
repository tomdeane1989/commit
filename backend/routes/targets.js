// routes/targets.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';

const router = express.Router();
const prisma = new PrismaClient();

const targetSchema = Joi.object({
  user_id: Joi.string().optional(),
  period_start: Joi.date().required(),
  period_end: Joi.date().required(),
  target_amount: Joi.number().positive().required(),
  commission_rate: Joi.number().min(0).max(1).required(),
  currency: Joi.string().length(3).default('GBP')
});

// Get all targets
router.get('/', async (req, res) => {
  try {
    const { user_id, active_only = 'false' } = req.query;
    
    const where = {
      ...(user_id ? { user_id } : { user_id: req.user.id }),
      ...(active_only === 'true' && { is_active: true })
    };

    // Check permissions
    if (user_id && user_id !== req.user.id && req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const targets = await prisma.sales_targets.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json(targets);
  } catch (error) {
    console.error('Get targets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create target
router.post('/', async (req, res) => {
  try {
    const { error, value } = targetSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const targetUserId = value.user_id || req.user.id;

    // Check permissions
    if (targetUserId !== req.user.id && req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check for overlapping periods
    const overlapping = await prisma.sales_targets.findFirst({
      where: {
        user_id: targetUserId,
        is_active: true,
        OR: [
          {
            period_start: { lte: value.period_end },
            period_end: { gte: value.period_start }
          }
        ]
      }
    });

    if (overlapping) {
      return res.status(400).json({ error: 'Overlapping target period exists' });
    }

    const target = await prisma.sales_targets.create({
      data: {
        ...value,
        user_id: targetUserId
      }
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        action: 'target_created',
        entity_type: 'target',
        entity_id: target.id,
        details: { 
          target_amount: target.target_amount,
          period_start: target.period_start,
          period_end: target.period_end
        }
      }
    });

    res.status(201).json(target);
  } catch (error) {
    console.error('Create target error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update target
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = targetSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const existingTarget = await prisma.sales_targets.findUnique({
      where: { id }
    });

    if (!existingTarget) {
      return res.status(404).json({ error: 'Target not found' });
    }

    if (existingTarget.user_id !== req.user.id && req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const target = await prisma.sales_targets.update({
      where: { id },
      data: value
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        action: 'target_updated',
        entity_type: 'target',
        entity_id: target.id,
        details: { target_amount: target.target_amount }
      }
    });

    res.json(target);
  } catch (error) {
    console.error('Update target error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deactivate target
router.patch('/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;

    const existingTarget = await prisma.sales_targets.findUnique({
      where: { id }
    });

    if (!existingTarget) {
      return res.status(404).json({ error: 'Target not found' });
    }

    if (existingTarget.user_id !== req.user.id && req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const target = await prisma.sales_targets.update({
      where: { id },
      data: { is_active: false }
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        action: 'target_deactivated',
        entity_type: 'target',
        entity_id: target.id,
        details: {}
      }
    });

    res.json(target);
  } catch (error) {
    console.error('Deactivate target error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;