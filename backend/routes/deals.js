// routes/deals.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';

const router = express.Router();
const prisma = new PrismaClient();

const dealSchema = Joi.object({
  deal_name: Joi.string().required(),
  account_name: Joi.string().required(),
  amount: Joi.number().positive().required(),
  probability: Joi.number().min(0).max(100).default(0),
  status: Joi.string().valid('open', 'closed_won', 'closed_lost').default('open'),
  stage: Joi.string().optional(),
  close_date: Joi.date().required(),
  closed_date: Joi.date().optional(),
  created_date: Joi.date().optional(),
  crm_id: Joi.string().optional(),
  crm_type: Joi.string().valid('salesforce', 'hubspot', 'pipedrive', 'sheets', 'manual').default('manual'),
  crm_url: Joi.string().optional()
});

// Get all deals for user
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, status, category, from_date, to_date } = req.query;
    
    const where = {
      user_id: req.user.id,
      ...(status && { status }),
      ...(from_date && to_date && {
        close_date: {
          gte: new Date(from_date),
          lte: new Date(to_date)
        }
      })
    };

    // For category filtering, we need to join with deal_categorizations
    const includeCategories = {
      deal_categorizations: {
        orderBy: { created_at: 'desc' },
        take: 1
      }
    };

    const deals = await prisma.deals.findMany({
      where,
      include: includeCategories,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit)
    });

    const total = await prisma.deals.count({ where });

    res.json({
      deals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get deals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create deal
router.post('/', async (req, res) => {
  try {
    const { error, value } = dealSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const deal = await prisma.deals.create({
      data: {
        ...value,
        user_id: req.user.id,
        company_id: req.user.company_id
      }
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        action: 'deal_created',
        entity_type: 'deal',
        entity_id: deal.id,
        details: { deal_name: deal.deal_name, amount: deal.amount }
      }
    });

    res.status(201).json(deal);
  } catch (error) {
    console.error('Create deal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update deal
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = dealSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const existingDeal = await prisma.deals.findUnique({
      where: { id }
    });

    if (!existingDeal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    if (existingDeal.user_id !== req.user.id && req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const deal = await prisma.deals.update({
      where: { id },
      data: value
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        action: 'deal_updated',
        entity_type: 'deal',
        entity_id: deal.id,
        details: { deal_name: deal.deal_name }
      }
    });

    res.json(deal);
  } catch (error) {
    console.error('Update deal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete deal
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existingDeal = await prisma.deals.findUnique({
      where: { id }
    });

    if (!existingDeal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    if (existingDeal.user_id !== req.user.id && req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.deals.delete({
      where: { id }
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        action: 'deal_deleted',
        entity_type: 'deal',
        entity_id: id,
        details: { deal_name: existingDeal.deal_name }
      }
    });

    res.json({ message: 'Deal deleted successfully' });
  } catch (error) {
    console.error('Delete deal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;