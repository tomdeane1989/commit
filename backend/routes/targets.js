// routes/targets.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';

const router = express.Router();
const prisma = new PrismaClient();

const targetSchema = Joi.object({
  user_id: Joi.string().optional(),
  period_type: Joi.string().valid('monthly', 'quarterly', 'annual').required(),
  period_start: Joi.date().required(),
  period_end: Joi.date().required(),
  quota_amount: Joi.number().positive().required(),
  commission_rate: Joi.number().min(0).max(1).required()
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

    const targets = await prisma.targets.findMany({
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

    res.json({
      targets,
      success: true
    });
  } catch (error) {
    console.error('Get targets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create target
router.post('/', async (req, res) => {
  try {
    // Only admins and managers can create targets
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Only admins and managers can create targets' });
    }

    const { target_type, user_id, role, period_type, period_start, period_end, quota_amount, commission_rate } = req.body;

    // Validate required fields
    if (!target_type || !period_type || !period_start || !period_end || !quota_amount || !commission_rate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (target_type === 'individual' && !user_id) {
      return res.status(400).json({ error: 'User ID required for individual targets' });
    }

    if (target_type === 'role' && !role) {
      return res.status(400).json({ error: 'Role required for role-based targets' });
    }

    let targetUsers = [];

    if (target_type === 'individual') {
      // Validate user exists and is in same company
      const user = await prisma.users.findUnique({
        where: { 
          id: user_id,
          company_id: req.user.company_id
        }
      });

      if (!user) {
        return res.status(400).json({ error: 'User not found' });
      }

      targetUsers = [user];
    } else {
      // Get all users with the specified role
      targetUsers = await prisma.users.findMany({
        where: {
          company_id: req.user.company_id,
          role: role,
          is_active: true
        }
      });

      if (targetUsers.length === 0) {
        return res.status(400).json({ error: `No active users found with role: ${role}` });
      }
    }

    const createdTargets = [];

    // Create targets for each user
    for (const targetUser of targetUsers) {
      // Check for overlapping periods
      const overlapping = await prisma.targets.findFirst({
        where: {
          user_id: targetUser.id,
          is_active: true,
          OR: [
            {
              period_start: { lte: new Date(period_end) },
              period_end: { gte: new Date(period_start) }
            }
          ]
        }
      });

      if (overlapping) {
        console.warn(`Skipping overlapping target for user ${targetUser.first_name} ${targetUser.last_name}`);
        continue;
      }

      // Deactivate any existing active targets for this user
      await prisma.targets.updateMany({
        where: {
          user_id: targetUser.id,
          is_active: true
        },
        data: {
          is_active: false
        }
      });

      // Create new target
      const target = await prisma.targets.create({
        data: {
          user_id: targetUser.id,
          company_id: req.user.company_id,
          period_type,
          period_start: new Date(period_start),
          period_end: new Date(period_end),
          quota_amount,
          commission_rate,
          is_active: true
        }
      });

      createdTargets.push(target);

      // Log activity
      await prisma.activity_log.create({
        data: {
          user_id: req.user.id,
          company_id: req.user.company_id,
          action: 'target_created',
          entity_type: 'target',
          entity_id: target.id,
          context: { 
            target_type,
            target_user: `${targetUser.first_name} ${targetUser.last_name}`,
            quota_amount: target.quota_amount,
            period_start: target.period_start,
            period_end: target.period_end
          },
          success: true
        }
      });
    }

    res.status(201).json({
      targets: createdTargets,
      message: `Created ${createdTargets.length} target${createdTargets.length !== 1 ? 's' : ''} successfully`
    });
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

    const existingTarget = await prisma.targets.findUnique({
      where: { id }
    });

    if (!existingTarget) {
      return res.status(404).json({ error: 'Target not found' });
    }

    if (existingTarget.user_id !== req.user.id && req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const target = await prisma.targets.update({
      where: { id },
      data: value
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'target_updated',
        entity_type: 'target',
        entity_id: target.id,
        context: { quota_amount: target.quota_amount },
        success: true
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

    const existingTarget = await prisma.targets.findUnique({
      where: { id }
    });

    if (!existingTarget) {
      return res.status(404).json({ error: 'Target not found' });
    }

    if (existingTarget.user_id !== req.user.id && req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const target = await prisma.targets.update({
      where: { id },
      data: { is_active: false }
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'target_deactivated',
        entity_type: 'target',
        entity_id: target.id,
        context: {},
        success: true
      }
    });

    res.json(target);
  } catch (error) {
    console.error('Deactivate target error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;