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
import authRoutes from './routes/auth.js';
import teamsRoutes from './routes/teams.js';
import targetsRoutes from './routes/targets.js';
import dealsRoutes from './routes/deals.js';
import commissionsRoutes from './routes/commissions.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;
const prisma = new PrismaClient();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL
  ].filter(Boolean),
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

// Use secure auth middleware for all protected routes
const authMiddleware = authenticateToken;

// Protected routes (require authentication)
app.use('/api/team', authMiddleware, teamsRoutes);
app.use('/api/targets', authMiddleware, targetsRoutes);
app.use('/api/deals', authMiddleware, dealsRoutes);
app.use('/api/commissions', authMiddleware, commissionsRoutes);

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

// Team management routes
app.get('/api/team', authMiddleware, async (req, res) => {
  try {
    // Only admins and managers can view team
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const teamMembers = await prisma.users.findMany({
      where: { company_id: req.user.company_id },
      include: {
        manager: {
          select: { first_name: true, last_name: true, email: true }
        },
        reports: {
          select: { id: true, first_name: true, last_name: true, email: true }
        },
        deals: {
          where: { status: 'open' },
          select: { amount: true }
        },
        targets: {
          where: { is_active: true },
          select: { quota_amount: true }
        },
        commissions: {
          select: { commission_earned: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // Calculate performance metrics for each team member
    const teamWithMetrics = teamMembers.map(member => {
      const openDealsAmount = member.deals.reduce((sum, deal) => sum + Number(deal.amount), 0);
      const currentQuota = member.targets.length > 0 ? Number(member.targets[0].quota_amount) : 0;
      const totalCommissions = member.commissions.reduce((sum, comm) => sum + Number(comm.commission_earned), 0);
      
      return {
        id: member.id,
        email: member.email,
        first_name: member.first_name,
        last_name: member.last_name,
        role: member.role,
        is_active: member.is_active,
        hire_date: member.hire_date,
        territory: member.territory,
        created_at: member.created_at,
        manager: member.manager,
        reports_count: member.reports.length,
        performance: {
          open_deals_amount: openDealsAmount,
          current_quota: currentQuota,
          total_commissions: totalCommissions,
          open_deals_count: member.deals.length
        }
      };
    });

    res.json({
      team_members: teamWithMetrics,
      success: true
    });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/team/invite', authMiddleware, async (req, res) => {
  try {
    // Only admins can invite team members
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can invite team members' });
    }

    const { email, first_name, last_name, role, territory, manager_id } = req.body;

    // Validate required fields
    if (!email || !first_name || !last_name || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Validate manager exists if provided
    if (manager_id) {
      const manager = await prisma.users.findUnique({
        where: { 
          id: manager_id,
          company_id: req.user.company_id
        }
      });

      if (!manager) {
        return res.status(400).json({ error: 'Invalid manager ID' });
      }
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Create user
    const newUser = await prisma.users.create({
      data: {
        email,
        password: hashedPassword,
        first_name,
        last_name,
        role,
        territory,
        manager_id,
        company_id: req.user.company_id
      },
      include: {
        manager: {
          select: { first_name: true, last_name: true, email: true }
        }
      }
    });

    // Log the invitation
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'team_member_invited',
        entity_type: 'user',
        entity_id: newUser.id,
        context: {
          invited_email: email,
          invited_role: role,
          invited_by: req.user.email
        },
        success: true
      }
    });

    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        role: newUser.role,
        territory: newUser.territory,
        manager: newUser.manager,
        created_at: newUser.created_at
      },
      temp_password: tempPassword,
      message: 'Team member invited successfully'
    });
  } catch (error) {
    console.error('Team invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/team/:userId', authMiddleware, async (req, res) => {
  try {
    // Only admins can edit team members
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can edit team members' });
    }

    const { userId } = req.params;
    const { first_name, last_name, role, territory, manager_id, is_active } = req.body;

    // Validate user exists and is in same company
    const existingUser = await prisma.users.findUnique({
      where: { 
        id: userId,
        company_id: req.user.company_id
      }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate manager exists if provided
    if (manager_id) {
      const manager = await prisma.users.findUnique({
        where: { 
          id: manager_id,
          company_id: req.user.company_id
        }
      });

      if (!manager) {
        return res.status(400).json({ error: 'Invalid manager ID' });
      }
    }

    // Update user
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: {
        first_name,
        last_name,
        role,
        territory,
        manager_id,
        is_active
      },
      include: {
        manager: {
          select: { first_name: true, last_name: true, email: true }
        }
      }
    });

    // Log the update
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'team_member_updated',
        entity_type: 'user',
        entity_id: userId,
        context: {
          updated_fields: { first_name, last_name, role, territory, manager_id, is_active },
          updated_by: req.user.email
        },
        success: true
      }
    });

    res.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        role: updatedUser.role,
        territory: updatedUser.territory,
        is_active: updatedUser.is_active,
        manager: updatedUser.manager,
        updated_at: updatedUser.updated_at
      },
      message: 'Team member updated successfully'
    });
  } catch (error) {
    console.error('Team update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/team/:userId', authMiddleware, async (req, res) => {
  try {
    // Only admins can delete team members
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete team members' });
    }

    const { userId } = req.params;

    // Validate user exists and is in same company
    const existingUser = await prisma.users.findUnique({
      where: { 
        id: userId,
        company_id: req.user.company_id
      }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cannot delete self
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    // Deactivate instead of delete to preserve data integrity
    await prisma.users.update({
      where: { id: userId },
      data: { is_active: false }
    });

    // Log the deactivation
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'team_member_deactivated',
        entity_type: 'user',
        entity_id: userId,
        context: {
          deactivated_email: existingUser.email,
          deactivated_by: req.user.email
        },
        success: true
      }
    });

    res.json({ message: 'Team member deactivated successfully' });
  } catch (error) {
    console.error('Team delete error:', error);
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

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on 127.0.0.1:${PORT}`);
});