// routes/deals.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';
import { attachPermissions, requireOwnerOrManager } from '../middleware/permissions.js';
import { canManageTeam } from '../middleware/roleHelpers.js';
import dealCommissionCalculator from '../services/dealCommissionCalculator.js';

const router = express.Router();
const prisma = new PrismaClient();

// Attach permissions to all routes for conditional logic
router.use(attachPermissions);

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

// Get all deals for user with manager filtering support
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, status, category, from_date, to_date, view, user_id, period } = req.query;
    
    let where = {
      user_id: req.user.id,
      company_id: req.user.company_id,
      ...(status && { status })
    };

    // Add date filtering - either custom dates or period-based
    if (from_date && to_date) {
      // Custom date range
      where.close_date = {
        gte: new Date(from_date),
        lte: new Date(to_date)
      };
    } else if (period) {
      // Period-based filtering (same logic as team API)
      const now = new Date();
      let startDate, endDate;
      
      if (period === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      } else if (period === 'quarterly') {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59, 999);
      } else if (period === 'yearly') {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      } else if (period === 'weekly') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        startDate = startOfWeek;
        endDate = endOfWeek;
      }
      
      if (startDate && endDate) {
        // Filter deals by close_date within the period
        where.close_date = {
          gte: startDate,
          lte: endDate
        };
      }
    }

    // Manager view filtering - use permissions from middleware
    if (req.permissions.canManageTeam && view) {
      if (view === 'personal') {
        // Manager's own deals only
        where.user_id = req.user.id;
      } else if (view === 'team') {
        // Get all direct reports
        const directReports = await prisma.users.findMany({
          where: {
            manager_id: req.user.id,
            company_id: req.user.company_id,
            is_active: true
          },
          select: { id: true }
        });
        
        const teamMemberIds = directReports.map(dr => dr.id);
        if (teamMemberIds.length > 0) {
          where.user_id = { in: teamMemberIds };
        } else {
          // No team members, return empty result
          return res.json({
            deals: [],
            pagination: { total: 0, page: 1, totalPages: 0 },
            summary: { total_count: 0, total_amount: 0, avg_probability: 0 },
            team_summary: null
          });
        }
      } else if (view === 'member' && user_id) {
        // Specific team member's deals - verify they report to this manager
        const teamMember = await prisma.users.findUnique({
          where: { 
            id: user_id,
            manager_id: req.user.id,
            company_id: req.user.company_id,
            is_active: true
          }
        });
        
        if (!teamMember) {
          return res.status(403).json({ error: 'Access denied - user is not your direct report' });
        }
        
        where.user_id = user_id;
      } else if (view === 'all') {
        // Manager's deals + team's deals
        const directReports = await prisma.users.findMany({
          where: {
            manager_id: req.user.id,
            company_id: req.user.company_id,
            is_active: true
          },
          select: { id: true }
        });
        
        const teamMemberIds = directReports.map(dr => dr.id);
        teamMemberIds.push(req.user.id); // Include manager's own deals
        where.user_id = { in: teamMemberIds };
      }
    }

    // For category filtering, we need to join with deal_categorizations
    const includeCategories = {
      deal_categorizations: {
        orderBy: { created_at: 'desc' },
        take: 1,
        include: {
          user: {
            select: {
              first_name: true,
              last_name: true,
              email: true
            }
          }
        }
      },
      // Include user info for team/manager views
      user: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          role: true
        }
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

    // Calculate summary statistics
    const totalAmount = dealsWithCategory.reduce((sum, deal) => sum + Number(deal.amount), 0);
    const avgProbability = dealsWithCategory.length > 0 
      ? dealsWithCategory.reduce((sum, deal) => sum + (deal.probability || 0), 0) / dealsWithCategory.length 
      : 0;

    // Category breakdown for team views
    const categoryBreakdown = {
      uncategorized: dealsWithCategory.filter(d => d.deal_type === 'uncategorized').length,
      commit: dealsWithCategory.filter(d => d.deal_type === 'commit').length,
      best_case: dealsWithCategory.filter(d => d.deal_type === 'best_case').length,
      closed_won: dealsWithCategory.filter(d => d.deal_type === 'closed_won').length
    };

    // Team member breakdown (for team/all views)
    let teamSummary = null;
    if (req.permissions.canManageTeam && (view === 'team' || view === 'all')) {
      const teamStats = {};
      dealsWithCategory.forEach(deal => {
        const ownerId = deal.user_id;
        const ownerName = `${deal.user.first_name} ${deal.user.last_name}`;
        
        if (!teamStats[ownerId]) {
          teamStats[ownerId] = {
            user_id: ownerId,
            name: ownerName,
            email: deal.user.email,
            deal_count: 0,
            total_amount: 0,
            categories: { uncategorized: 0, commit: 0, best_case: 0, closed_won: 0 }
          };
        }
        
        teamStats[ownerId].deal_count++;
        teamStats[ownerId].total_amount += Number(deal.amount);
        teamStats[ownerId].categories[deal.deal_type]++;
      });
      
      teamSummary = Object.values(teamStats);
    }

    res.json({
      deals: dealsWithCategory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      summary: {
        total_count: dealsWithCategory.length,
        total_amount: totalAmount,
        avg_probability: Math.round(avgProbability * 10) / 10,
        category_breakdown: categoryBreakdown
      },
      team_summary: teamSummary,
      view_context: {
        current_view: view || 'personal',
        is_manager: req.permissions.canManageTeam,
        selected_user_id: user_id || null
      },
      success: true
    });
  } catch (error) {
    console.error('Get deals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get team members for manager (for individual member filtering)
router.get('/team-members', async (req, res) => {
  try {
    // Only managers can access this endpoint - use permissions from middleware
    if (!req.permissions.canManageTeam) {
      return res.status(403).json({ error: 'Access denied - managers only' });
    }

    const directReports = await prisma.users.findMany({
      where: {
        manager_id: req.user.id,
        company_id: req.user.company_id,
        is_active: true
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        role: true
      },
      orderBy: { first_name: 'asc' }
    });

    res.json({
      team_members: directReports,
      success: true
    });

  } catch (error) {
    console.error('Get team members error:', error);
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

    // If deal is created as closed_won, calculate commission
    if (deal.stage === 'closed_won') {
      await dealCommissionCalculator.calculateDealCommission(deal.id);
    }


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

    if (existingDeal.user_id !== req.user.id && !req.permissions.canManageTeam) {
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

    // Check if stage changed and calculate commission
    if (existingDeal.stage !== deal.stage) {
      await dealCommissionCalculator.handleDealUpdate(deal.id, existingDeal.stage, deal.stage);
    }


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

    if (existingDeal.user_id !== req.user.id && !req.permissions.canManageTeam) {
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

    // Validate that user owns this deal OR is a manager who can access team deals
    let deal;
    
    if (req.permissions.canManageTeam) {
      // Managers can categorize deals for their team members (same company)
      deal = await prisma.deals.findFirst({
        where: { 
          id: dealId,
          user: {
            company_id: req.user.company_id // Must be same company
          }
        },
        include: {
          user: {
            select: { id: true, first_name: true, last_name: true, email: true }
          }
        }
      });
    } else {
      // Regular users can only categorize their own deals
      deal = await prisma.deals.findFirst({
        where: { 
          id: dealId,
          user_id: req.user.id 
        },
        include: {
          user: {
            select: { id: true, first_name: true, last_name: true, email: true }
          }
        }
      });
    }

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Use the deal owner's ID for categorization (could be different from req.user.id if manager is categorizing)
    const dealOwnerId = deal.user ? deal.user.id : deal.user_id;
    
    // If moving to pipeline, remove any existing categorization
    if (deal_type === 'pipeline') {
      await prisma.deal_categorizations.deleteMany({
        where: { 
          deal_id: dealId,
          user_id: dealOwnerId 
        }
      });
    } else {
      // Remove any existing categorization for this deal by the deal owner
      await prisma.deal_categorizations.deleteMany({
        where: { 
          deal_id: dealId,
          user_id: dealOwnerId 
        }
      });

      // Create new categorization (attributed to deal owner, but action logged by current user)
      await prisma.deal_categorizations.create({
        data: {
          deal_id: dealId,
          user_id: dealOwnerId,
          category: deal_type,
          confidence_note: `Categorized via ${user_context?.categorization_method || 'manual'}${req.user.id !== dealOwnerId ? ` by manager ${req.user.email}` : ''}`
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


    // Check if this is a manager categorizing someone else's deal
    const isManagerAction = req.user.id !== dealOwnerId;
    const dealOwnerInfo = deal.user ? {
      id: deal.user.id,
      first_name: deal.user.first_name,
      last_name: deal.user.last_name,
      email: deal.user.email
    } : null;

    res.json({ 
      id: dealId,
      current_category: deal_type,
      previous_category,
      message: isManagerAction 
        ? `Deal categorization updated successfully by manager for ${dealOwnerInfo?.first_name} ${dealOwnerInfo?.last_name}`
        : 'Deal categorization updated successfully',
      manager_action: isManagerAction,
      deal_owner: dealOwnerInfo,
      categorized_by: {
        id: req.user.id,
        first_name: req.user.first_name,
        last_name: req.user.last_name,
        email: req.user.email
      }
    });
  } catch (error) {
    console.error('Update deal categorization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;