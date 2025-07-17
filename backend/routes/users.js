import express from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import Joi from 'joi';

const router = express.Router();
const prisma = new PrismaClient();

const updateUserSchema = Joi.object({
  first_name: Joi.string().optional(),
  last_name: Joi.string().optional(),
  territory: Joi.string().optional().allow(''),
  manager_id: Joi.string().optional().allow('')
});

const passwordSchema = Joi.object({
  current_password: Joi.string().required(),
  new_password: Joi.string().min(8).required()
});

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        territory: true,
        manager_id: true,
        created_at: true,
        updated_at: true,
        company: {
          select: {
            id: true,
            name: true,
            domain: true,
            subscription: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const { error, value } = updateUserSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const user = await prisma.users.update({
      where: { id: req.user.id },
      data: value,
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        territory: true,
        manager_id: true,
        updated_at: true
      }
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'profile_updated',
        entity_type: 'user',
        entity_id: req.user.id,
        details: { updated_fields: Object.keys(value) }
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
router.put('/password', async (req, res) => {
  try {
    const { error, value } = passwordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { current_password, new_password } = value;

    // Get current user with password
    const user = await prisma.users.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await prisma.users.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'password_changed',
        entity_type: 'user',
        entity_id: req.user.id,
        details: {}
      }
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get team members (for managers/admins)
router.get('/team', async (req, res) => {
  try {
    if (req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const where = {
      company_id: req.user.company_id,
      is_active: true
    };

    // If manager, only show their reports
    if (req.user.role === 'manager') {
      where.manager_id = req.user.id;
    }

    const users = await prisma.users.findMany({
      where,
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        territory: true,
        manager_id: true,
        created_at: true,
        performance_profile: true
      },
      orderBy: [
        { role: 'asc' },
        { first_name: 'asc' }
      ]
    });

    res.json(users);
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user activity log
router.get('/activity', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const activities = await prisma.activity_log.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit)
    });

    const total = await prisma.activity_log.count({
      where: { user_id: req.user.id }
    });

    res.json({
      activities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get activity log error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;