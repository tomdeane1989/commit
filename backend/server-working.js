import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;
const prisma = new PrismaClient();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Auth middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.users.findUnique({
      where: { id: decoded.id },
      include: { company: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, first_name, last_name, company_name } = req.body;

    // Check if user exists
    const existingUser = await prisma.users.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create company first
    const company = await prisma.companies.create({
      data: {
        name: company_name
      }
    });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.users.create({
      data: {
        email,
        password: hashedPassword,
        first_name,
        last_name,
        company_id: company.id,
        role: 'admin' // First user becomes admin
      }
    });

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        company_id: user.company_id
      },
      token,
      expires_in: 7 * 24 * 60 * 60 // 7 days in seconds
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.users.findUnique({
      where: { email },
      include: { company: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        company_id: user.company_id
      },
      token,
      expires_in: 7 * 24 * 60 * 60
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  res.json(req.user);
});

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

// Targets routes
app.get('/api/targets', authMiddleware, async (req, res) => {
  try {
    const targets = await prisma.targets.findMany({
      where: { user_id: req.user.id },
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

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});