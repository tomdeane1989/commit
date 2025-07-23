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

app.use('/api/admin', adminRoutes);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;
const prisma = new PrismaClient();

// Security middleware
app.use(helmet());
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://commit-snowy.vercel.app' // ← your live frontend
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

    // Categorize deals
    const categorizedDeals = {
      closed: [],
      commit: [],
      best_case: [],
      pipeline: []
    };

    deals.forEach(deal => {
      const dealWithType = {
        ...deal,
        amount: Number(deal.amount)
      };

      if (deal.status === 'closed_won') {
        categorizedDeals.closed.push(dealWithType);
      } else if (deal.deal_categorizations.length > 0) {
        const category = deal.deal_categorizations[0].category;
        if (category === 'commit') {
          categorizedDeals.commit.push(dealWithType);
        } else if (category === 'best_case') {
          categorizedDeals.best_case.push(dealWithType);
        } else {
          categorizedDeals.pipeline.push(dealWithType);
        }
      } else {
        categorizedDeals.pipeline.push(dealWithType);
      }
    });

    // Calculate amounts
    const closedAmount = categorizedDeals.closed.reduce((sum, deal) => sum + deal.amount, 0);
    const commitAmount = categorizedDeals.commit.reduce((sum, deal) => sum + deal.amount, 0);
    const bestCaseAmount = categorizedDeals.best_case.reduce((sum, deal) => sum + deal.amount, 0);
    const totalQuota = currentTarget ? Number(currentTarget.quota_amount) : 0;
    
    const quotaAttainment = totalQuota > 0 ? (closedAmount / totalQuota) * 100 : 0;
    const projectedCommission = currentTarget ? (closedAmount + commitAmount) * Number(currentTarget.commission_rate) : 0;

    // Get commission earned
    const commissionEarned = await prisma.commissions.aggregate({
      where: { user_id: req.user.id },
      _sum: { commission_earned: true }
    });

    res.json({
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
      deals: categorizedDeals
    });
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