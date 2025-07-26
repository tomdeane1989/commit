import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { apiRateLimit, authenticateToken } from './middleware/secureAuth.js';
import { csrfProtection, csrfTokenHandler } from './middleware/csrfProtection.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import teamsRoutes from './routes/teams.js';
import targetsRoutes from './routes/targets.js';
import dealsRoutes from './routes/deals.js';
import commissionsRoutes from './routes/commissions.js';
import integrationsRoutes from './routes/integrations.js';



dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;
const prisma = new PrismaClient();

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

// Security middleware
app.use(helmet());
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://commit-snowy.vercel.app', // ← your live frontend
  'https://commit-git-staging-dashboard-enha-505531-toms-projects-5fc7012e.vercel.app' // ← staging frontend
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Allow server-to-server or Postman
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Cookie parser for authentication
app.use(cookieParser());

// Rate limiting (disabled for development)
// app.use(apiRateLimit);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CSRF protection (disabled for development)
// app.use(csrfProtection);

// CSRF token endpoint (disabled for development)
// app.get('/api/csrf-token', csrfTokenHandler);

// Use secure authentication routes (no auth required)
app.use('/api/auth', authRoutes);

// Public template downloads (no auth required)
app.get('/api/integrations/template/sheets', async (req, res) => {
  try {
    const { format = 'csv' } = req.query;

    // Sample data that matches our expected format with Deal ID as first column
    const templateData = [
      // Header row - Deal ID is now the first and primary unique identifier
      ['Deal ID', 'Deal Name', 'Account Name', 'Amount', 'Probability', 'Status', 'Stage', 'Close Date', 'Created Date', 'Owned By'],
      // Sample rows with realistic B2B deal data - each has a unique Deal ID
      ['DEAL-2025-001', 'Enterprise Software License', 'TechCorp Industries', '45000', '75', 'Open', 'Proposal Submitted', '2025-08-15', '2025-06-01', 'john.smith@company.com'],
      ['DEAL-2025-002', 'Annual Support Contract', 'DataFlow Solutions', '28000', '90', 'Open', 'Contract Review', '2025-07-30', '2025-05-15', 'sarah.jones@company.com'],
      ['DEAL-2025-003', 'Cloud Migration Services', 'RetailPlus Ltd', '67000', '100', 'Closed Won', 'Closed Won', '2025-07-12', '2025-04-20', 'test@company.com'],
      ['DEAL-2025-004', 'Marketing Automation Setup', 'GrowthTech Startup', '15000', '60', 'Open', 'Discovery Call', '2025-09-01', '2025-07-10', 'john.smith@company.com'],
      ['DEAL-2025-005', 'Data Analytics Platform', 'InsightCorp', '89000', '85', 'Open', 'Technical Demo', '2025-08-20', '2025-05-30', 'sarah.jones@company.com']
    ];

    if (format.toLowerCase() === 'csv') {
      // Generate CSV content
      const csvContent = templateData
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="sales-pipeline-template.csv"');
      res.send(csvContent);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Only CSV format is currently supported'
      });
    }
  } catch (error) {
    console.error('Template download error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate template'
    });
  }
});

// Use secure auth middleware for all protected routes
const authMiddleware = authenticateToken;

// Protected routes (require authentication)

app.use('/api/admin', adminRoutes);
app.use('/api/team', authMiddleware, teamsRoutes);
app.use('/api/targets', authMiddleware, targetsRoutes);
app.use('/api/deals', authMiddleware, dealsRoutes);
app.use('/api/commissions', (req, res, next) => {
  console.log('🔍 COMMISSIONS MIDDLEWARE: ', req.method, req.url, req.path);
  next();
}, authMiddleware, commissionsRoutes);
app.use('/api/integrations', authMiddleware, integrationsRoutes);

// Dashboard routes
app.get('/api/dashboard/sales-rep', authMiddleware, async (req, res) => {
  const { view, user_id } = req.query;
  try {
    console.log('Dashboard API: req.user.id =', req.user.id);
    console.log('Dashboard API: req.user.email =', req.user.email);
    console.log('Dashboard API: view =', view, 'user_id =', user_id);
    
    // Determine which user(s) to get data for
    let targetUserIds = [req.user.id];
    let targetUserId = req.user.id;
    
    if (req.user.role === 'manager' && view) {
      if (view === 'member' && user_id) {
        // Individual team member view
        targetUserIds = [user_id];
        targetUserId = user_id;
      } else if (view === 'team') {
        // Get all team members (excluding manager)
        const teamMembers = await prisma.users.findMany({
          where: {
            company_id: req.user.company_id,
            is_active: true,
            role: 'sales_rep'
          },
          select: { id: true }
        });
        targetUserIds = teamMembers.map(member => member.id);
        targetUserId = targetUserIds[0] || req.user.id; // Fallback for targets query
      } else if (view === 'all') {
        // Manager + all team members
        const teamMembers = await prisma.users.findMany({
          where: {
            company_id: req.user.company_id,
            is_active: true,
            role: 'sales_rep'
          },
          select: { id: true }
        });
        targetUserIds = [req.user.id, ...teamMembers.map(member => member.id)];
      }
      // 'personal' view uses default (req.user.id)
    }
    
    console.log('Dashboard API: targetUserIds =', targetUserIds);
    
    // Get current target (use first target user for single target scenarios)
    const currentTarget = await prisma.targets.findFirst({
      where: { 
        user_id: targetUserId,
        is_active: true 
      }
    });
    console.log('Dashboard API: currentTarget =', currentTarget);

    // Get deals with categorizations for target users
    const deals = await prisma.deals.findMany({
      where: { 
        user_id: { in: targetUserIds }
      },
      include: {
        deal_categorizations: {
          orderBy: { created_at: 'desc' },
          take: 1
        }
      },
      orderBy: { created_at: 'desc' }
    });
    console.log('Dashboard API: Found', deals.length, 'deals for users:', targetUserIds);

    // Categorize deals
    const categorizedDeals = {
      closed: [],
      commit: [],
      best_case: [],
      pipeline: []
    };

    console.log('Dashboard API: Starting deal categorization loop...');
    deals.forEach((deal, index) => {
      console.log(`Dashboard API: Processing deal ${index + 1}/${deals.length}:`, deal.id);
      
      const dealWithType = {
        ...deal,
        amount: Number(deal.amount)
      };

      if (deal.status === 'closed_won') {
        categorizedDeals.closed.push(dealWithType);
        console.log(`Dashboard API: Deal ${deal.id} -> closed`);
      } else if (deal.deal_categorizations.length > 0) {
        const category = deal.deal_categorizations[0].category;
        console.log(`Dashboard API: Deal ${deal.id} has categorization:`, category);
        if (category === 'commit') {
          categorizedDeals.commit.push(dealWithType);
        } else if (category === 'best_case') {
          categorizedDeals.best_case.push(dealWithType);
        } else {
          categorizedDeals.pipeline.push(dealWithType);
        }
      } else {
        categorizedDeals.pipeline.push(dealWithType);
        console.log(`Dashboard API: Deal ${deal.id} -> pipeline (no categorization)`);
      }
    });
    
    console.log('Dashboard API: Deal categorization completed');
    console.log('Dashboard API: Categorization summary:', {
      closed: categorizedDeals.closed.length,
      commit: categorizedDeals.commit.length,
      best_case: categorizedDeals.best_case.length,
      pipeline: categorizedDeals.pipeline.length
    });

    // Calculate amounts
    console.log('Dashboard API: Starting calculations...');
    const closedAmount = categorizedDeals.closed.reduce((sum, deal) => sum + deal.amount, 0);
    const commitAmount = categorizedDeals.commit.reduce((sum, deal) => sum + deal.amount, 0);
    const bestCaseAmount = categorizedDeals.best_case.reduce((sum, deal) => sum + deal.amount, 0);
    const totalQuota = currentTarget ? Number(currentTarget.quota_amount) : 0;
    
    console.log('Dashboard API: Amounts calculated:', { closedAmount, commitAmount, bestCaseAmount, totalQuota });
    
    const quotaAttainment = totalQuota > 0 ? (closedAmount / totalQuota) * 100 : 0;
    const projectedCommission = currentTarget ? (closedAmount + commitAmount) * Number(currentTarget.commission_rate) : 0;

    console.log('Dashboard API: Getting commission earned...');
    // Get commission earned for target users
    const commissionEarned = await prisma.commissions.aggregate({
      where: { 
        user_id: { in: targetUserIds }
      },
      _sum: { commission_earned: true }
    });
    console.log('Dashboard API: Commission earned retrieved:', commissionEarned);

    // Calculate deal analytics
    console.log('Dashboard API: Calculating deal analytics...');
    
    // Get all deal categorizations for target users to analyze behavior
    const allCategorizations = await prisma.deal_categorizations.findMany({
      where: { 
        user_id: { in: targetUserIds }
      },
      include: {
        deal: true
      },
      orderBy: { created_at: 'asc' }
    });
    
    console.log('Dashboard API: Found', allCategorizations.length, 'categorizations');
    
    // Calculate analytics
    const dealAnalytics = calculateDealAnalytics(allCategorizations, categorizedDeals.closed);
    
    // Get recent deal movements (last 10 categorizations)
    const recentMovements = allCategorizations
      .slice(-10)
      .reverse()
      .map(cat => ({
        id: cat.deal.id,
        deal_name: cat.deal.deal_name,
        deal_amount: Number(cat.deal.amount),
        category: cat.category,
        timestamp: cat.created_at,
        deal_status: cat.deal.status
      }));

    console.log('Dashboard API: Analytics calculated');
    console.log('Dashboard API: Preparing response...');
    const responseData = {
      user: req.user,
      current_target: currentTarget,
      metrics: {
        quota_attainment: quotaAttainment,
        closed_amount: closedAmount,
        commission_earned: Number(commissionEarned._sum.commission_earned || 0),
        projected_commission: projectedCommission,
        trend: 'stable'
      },
      quota_progress: {
        closed_amount: closedAmount,
        commit_amount: commitAmount,
        best_case_amount: bestCaseAmount,
        total_quota: totalQuota,
        commission_rate: currentTarget ? Number(currentTarget.commission_rate) : 0
      },
      deals: categorizedDeals,
      deal_analytics: dealAnalytics,
      recent_movements: recentMovements
    };
    
    console.log('Dashboard API: Sending response successfully');
    res.json(responseData);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deal categorization update
app.patch('/api/deals/:dealId/categorize', authMiddleware, async (req, res) => {
  try {
    const { dealId } = req.params;
    const { deal_type, previous_category, categorization_timestamp, user_context } = req.body;

    // Validate that user owns this deal OR is a manager who can access team deals
    let deal;
    
    if (req.user.role === 'manager') {
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
            select: {
              id: true,
              first_name: true,
              last_name: true,
              company_id: true
            }
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
            select: {
              id: true,
              first_name: true,
              last_name: true,
              company_id: true
            }
          }
        }
      });
    }

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found or access denied' });
    }

    // Use the deal owner's user ID for categorizations (affects their forecasting)
    const dealOwnerId = deal.user.id;
    
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

      // Create new categorization for the deal owner
      await prisma.deal_categorizations.create({
        data: {
          deal_id: dealId,
          user_id: dealOwnerId,
          category: deal_type,
          confidence_note: `Categorized via ${user_context?.categorization_method || 'manual'}${
            req.user.id !== dealOwnerId ? ` by manager ${req.user.first_name} ${req.user.last_name}` : ''
          }`
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

// Deals routes
app.get('/api/deals', authMiddleware, async (req, res) => {
  try {
    const deals = await prisma.deals.findMany({
      where: { user_id: req.user.id },
      include: {
        deal_categorizations: {
          orderBy: { created_at: 'desc' },
          take: 1 // Get the latest categorization
        }
      },
      orderBy: { created_at: 'desc' }
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

    res.json({
      deals: dealsWithCategory,
      success: true
    });
  } catch (error) {
    console.error('Get deals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Analytics routes
app.post('/api/analytics/categorization-log', authMiddleware, async (req, res) => {
  try {
    const { deal_id, from_category, to_category, timestamp, user_id, session_metadata } = req.body;
    
    // Log the categorization change for ML training
    await prisma.activity_log.create({
      data: {
        user_id: user_id || req.user.id,
        company_id: req.user.company_id,
        action: 'categorization_logged',
        entity_type: 'deal',
        entity_id: deal_id,
        before_state: { category: from_category },
        after_state: { category: to_category },
        context: {
          timestamp,
          session_metadata,
          source: 'frontend_analytics'
        },
        success: true
      }
    });

    res.json({ success: true, message: 'Categorization logged successfully' });
  } catch (error) {
    console.error('Analytics categorization log error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});


// 404 handler (must be after all routes)
app.use('*', notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
});