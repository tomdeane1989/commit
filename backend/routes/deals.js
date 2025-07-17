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

    // Add deal_type field based on categorization or status
    const dealsWithCategory = deals.map(deal => {
      let deal_type = 'pipeline'; // CRM deals default to pipeline (uncategorized)
      
      if (deal.status === 'closed_won') {
        deal_type = 'closed_won';
      } else if (deal.deal_categorizations.length > 0) {
        // User has manually categorized this deal
        deal_type = deal.deal_categorizations[0].category;
      }

      return {
        ...deal,
        deal_type,
        current_category: deal_type
      };
    });

    const total = await prisma.deals.count({ where });

    res.json({
      deals: dealsWithCategory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      success: true
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
        company_id: req.user.company_id,
        action: 'deal_created',
        entity_type: 'deal',
        entity_id: deal.id,
        context: { deal_name: deal.deal_name, amount: deal.amount },
        success: true
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
        company_id: req.user.company_id,
        action: 'deal_updated',
        entity_type: 'deal',
        entity_id: deal.id,
        context: { deal_name: deal.deal_name },
        success: true
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
        company_id: req.user.company_id,
        action: 'deal_deleted',
        entity_type: 'deal',
        entity_id: id,
        context: { deal_name: existingDeal.deal_name },
        success: true
      }
    });

    res.json({ message: 'Deal deleted successfully' });
  } catch (error) {
    console.error('Delete deal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deal categorization update
router.patch('/:dealId/categorize', async (req, res) => {
  try {
    const { dealId } = req.params;
    const { deal_type, previous_category, categorization_timestamp, user_context } = req.body;

    // Validate that user owns this deal
    const deal = await prisma.deals.findFirst({
      where: { 
        id: dealId,
        user_id: req.user.id 
      }
    });

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // If moving to pipeline, remove any existing categorization
    if (deal_type === 'pipeline') {
      await prisma.deal_categorizations.deleteMany({
        where: { 
          deal_id: dealId,
          user_id: req.user.id 
        }
      });
    } else {
      // Remove any existing categorization for this deal by this user
      await prisma.deal_categorizations.deleteMany({
        where: { 
          deal_id: dealId,
          user_id: req.user.id 
        }
      });

      // Create new categorization
      await prisma.deal_categorizations.create({
        data: {
          deal_id: dealId,
          user_id: req.user.id,
          category: deal_type,
          confidence_note: `Categorized via ${user_context?.categorization_method || 'manual'}`
        }
      });
    }

    // Log the change for ML training
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'deal_categorized',
        entity_type: 'deal',
        entity_id: dealId,
        before_state: { category: previous_category },
        after_state: { category: deal_type },
        context: {
          categorization_method: user_context?.categorization_method,
          session_id: user_context?.session_id,
          timestamp: categorization_timestamp
        },
        success: true
      }
    });

    res.json({ 
      id: dealId,
      current_category: deal_type,
      previous_category,
      message: 'Deal categorization updated successfully'
    });
  } catch (error) {
    console.error('Update deal categorization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;