// routes/dashboard.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { attachPermissions } from '../middleware/permissions.js';

const router = express.Router();
const prisma = new PrismaClient();

// Attach permissions to all routes for conditional logic
router.use(attachPermissions);

// Helper function to calculate deal behavior analytics
function calculateDealAnalytics(allCategorizations, closedDeals) {
  // Group categorizations by deal
  const dealCategorizationMap = new Map();
  
  allCategorizations.forEach(cat => {
    const dealId = cat.deal.id;
    if (!dealCategorizationMap.has(dealId)) {
      dealCategorizationMap.set(dealId, {
        deal: cat.deal,
        categorizations: []
      });
    }
    dealCategorizationMap.get(dealId).categorizations.push({
      category: cat.category,
      timestamp: cat.created_at
    });
  });

  // Analyze commit deals
  const commitAnalysis = analyzeCategory(dealCategorizationMap, closedDeals, 'commit');
  
  // Analyze best case deals  
  const bestCaseAnalysis = analyzeCategory(dealCategorizationMap, closedDeals, 'best_case');
  
  // Calculate sandbagging percentage
  const closedDealIds = new Set(closedDeals.map(deal => deal.id));
  const sandbagged = closedDeals.filter(deal => {
    const dealCats = dealCategorizationMap.get(deal.id);
    if (!dealCats) return true; // No categorizations = sandbagged
    
    // Check if deal ever had commit or best_case categorization
    const hasCommitOrBestCase = dealCats.categorizations.some(cat => 
      cat.category === 'commit' || cat.category === 'best_case'
    );
    return !hasCommitOrBestCase;
  });
  
  const sandbaggingRate = closedDeals.length > 0 ? (sandbagged.length / closedDeals.length) * 100 : 0;

  return {
    commit: commitAnalysis,
    best_case: bestCaseAnalysis,
    sandbagging: {
      percentage: sandbaggingRate,
      sandbagged_deals: sandbagged.length,
      total_closed_deals: closedDeals.length
    }
  };
}

// Helper function to analyze a specific category (commit or best_case)
function analyzeCategory(dealCategorizationMap, closedDeals, category) {
  const closedDealIds = new Set(closedDeals.map(deal => deal.id));
  
  // Find all deals that were ever categorized as this category
  const categoryDeals = [];
  const categoryAttempts = [];
  
  dealCategorizationMap.forEach((dealData, dealId) => {
    const hasCategory = dealData.categorizations.some(cat => cat.category === category);
    if (hasCategory) {
      categoryDeals.push(dealData.deal);
      
      // Count how many times this deal was moved to this category
      const attempts = dealData.categorizations.filter(cat => cat.category === category).length;
      categoryAttempts.push(attempts);
    }
  });
  
  // Calculate close rate for this category
  const closedFromCategory = categoryDeals.filter(deal => closedDealIds.has(deal.id));
  const closeRate = categoryDeals.length > 0 ? (closedFromCategory.length / categoryDeals.length) * 100 : 0;
  
  // Calculate average attempts
  const avgAttempts = categoryAttempts.length > 0 ? 
    categoryAttempts.reduce((sum, attempts) => sum + attempts, 0) / categoryAttempts.length : 0;
  
  return {
    close_rate: closeRate,
    total_deals: categoryDeals.length,
    closed_deals: closedFromCategory.length,
    average_attempts: avgAttempts
  };
}

// Get dashboard data for current user
router.get('/sales-rep', async (req, res) => {
  try {
    console.log('Dashboard API: req.user.id =', req.user.id);
    console.log('Dashboard API: req.user.email =', req.user.email);
    
    // Get current target
    const currentTarget = await prisma.targets.findFirst({
      where: { 
        user_id: req.user.id,
        is_active: true 
      }
    });
    console.log('Dashboard API: currentTarget =', currentTarget);

    // Get deals with categorizations
    const deals = await prisma.deals.findMany({
      where: { user_id: req.user.id },
      include: {
        deal_categorizations: {
          orderBy: { created_at: 'desc' },
          take: 1
        }
      },
      orderBy: { created_at: 'desc' }
    });
    console.log('Dashboard API: Found', deals.length, 'deals');

    // Simple response for debugging
    res.json({
      user: req.user,
      current_target: currentTarget,
      metrics: {
        quota_attainment: 0,
        closed_amount: 0,
        commission_earned: 0,
        projected_commission: 0,
        trend: 'stable'
      },
      quota_progress: {
        closed_amount: 0,
        commit_amount: 0,
        best_case_amount: 0,
        total_quota: currentTarget ? Number(currentTarget.quota_amount) : 0,
        commission_rate: currentTarget ? Number(currentTarget.commission_rate) : 0
      },
      deals: { closed: [], commit: [], best_case: [], pipeline: [] },
      deal_analytics: {
        commit: { close_rate: 75.5, total_deals: 8, closed_deals: 6, average_attempts: 1.2 },
        best_case: { close_rate: 45.0, total_deals: 10, closed_deals: 4, average_attempts: 2.1 },
        sandbagging: { percentage: 33.3, sandbagged_deals: 2, total_closed_deals: 6 }
      },
      recent_movements: [
        { id: '1', deal_name: 'Test Deal A', deal_amount: 50000, category: 'commit', timestamp: new Date(), deal_status: 'open' },
        { id: '2', deal_name: 'Test Deal B', deal_amount: 25000, category: 'best_case', timestamp: new Date(), deal_status: 'open' }
      ]
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dashboard data for specific user (managers/admins only)
router.get('/sales-rep/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Verify user can access this data - use permissions from middleware
    if (userId !== req.user.id && !req.permissions.canManageTeam) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const currentDate = new Date();
    const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

    // Get current sales target
    const currentTarget = await prisma.sales_targets.findFirst({
      where: {
        user_id: userId,
        period_start: { lte: currentDate },
        period_end: { gte: currentDate },
        is_active: true
      }
    });

    if (!currentTarget) {
      return res.status(404).json({ error: 'No active sales target found' });
    }

    // Get deals by category
    const deals = await prisma.deals.findMany({
      where: {
        user_id: userId,
        close_date: {
          gte: currentTarget.period_start,
          lte: currentTarget.period_end
        }
      },
      orderBy: { amount: 'desc' }
    });

    const closedDeals = deals.filter(d => d.status === 'closed_won');
    const commitDeals = deals.filter(d => d.deal_type === 'commit');
    const bestCaseDeals = deals.filter(d => d.deal_type === 'best_case');
    const pipelineDeals = deals.filter(d => d.deal_type === 'pipeline');

    // Calculate totals
    const closedAmount = closedDeals.reduce((sum, deal) => sum + Number(deal.amount), 0);
    const commitAmount = commitDeals.reduce((sum, deal) => sum + Number(deal.amount), 0);
    const bestCaseAmount = bestCaseDeals.reduce((sum, deal) => sum + Number(deal.amount), 0);

    const quotaAttainment = (closedAmount / Number(currentTarget.target_amount)) * 100;
    const projectedAttainment = ((closedAmount + commitAmount + bestCaseAmount) / Number(currentTarget.target_amount)) * 100;

    // Calculate commissions
    const earnedCommission = closedAmount * Number(currentTarget.commission_rate);
    const projectedCommission = (closedAmount + commitAmount + bestCaseAmount) * Number(currentTarget.commission_rate);

    const dashboardData = {
      target: {
        amount: Number(currentTarget.target_amount),
        period_start: currentTarget.period_start,
        period_end: currentTarget.period_end,
        commission_rate: Number(currentTarget.commission_rate)
      },
      performance: {
        closed_amount: closedAmount,
        quota_attainment: quotaAttainment,
        projected_attainment: projectedAttainment,
        earned_commission: earnedCommission,
        projected_commission: projectedCommission
      },
      deals: {
        closed: closedDeals,
        commit: commitDeals,
        best_case: bestCaseDeals,
        pipeline: pipelineDeals
      },
      summary: {
        total_deals: deals.length,
        closed_deals: closedDeals.length,
        commit_deals: commitDeals.length,
        best_case_deals: bestCaseDeals.length,
        pipeline_deals: pipelineDeals.length
      }
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update deal category (for drag & drop)
router.patch('/deals/:dealId/category', async (req, res) => {
  try {
    const { dealId } = req.params;
    const { deal_type } = req.body;

    const validTypes = ['closed', 'commit', 'best_case', 'pipeline'];
    if (!validTypes.includes(deal_type)) {
      return res.status(400).json({ error: 'Invalid deal type' });
    }

    const deal = await prisma.deals.findUnique({
      where: { id: dealId }
    });

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    if (deal.user_id !== req.user.id && !req.permissions.canManageTeam) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedDeal = await prisma.deals.update({
      where: { id: dealId },
      data: { deal_type }
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        action: 'deal_category_updated',
        entity_type: 'deal',
        entity_id: dealId,
        details: { 
          old_type: deal.deal_type,
          new_type: deal_type 
        }
      }
    });

    res.json(updatedDeal);
  } catch (error) {
    console.error('Deal category update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;