// routes/commissions-new.js
// NEW commission endpoints that query deals table directly
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { isAdmin, isManager, canManageTeam } from '../middleware/roleHelpers.js';
import { attachPermissions } from '../middleware/permissions.js';

const router = express.Router();
const prisma = new PrismaClient();

// Attach permissions to all routes
router.use(attachPermissions);

// Get commission data from deals table
router.get('/', async (req, res) => {
  try {
    const { 
      user_id, 
      period_view = 'quarterly',
      start_date,
      end_date,
      commission_type = 'actual',
      is_export = false
    } = req.query;

    // Permission check
    if (user_id && user_id !== req.user.id && !canManageTeam(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const targetUserId = user_id || req.user.id;

    // Get date range (default to last 12 months)
    let dateRange = {};
    if (start_date && end_date) {
      dateRange = {
        close_date: {
          gte: new Date(start_date),
          lte: new Date(end_date)
        }
      };
    } else {
      const now = new Date();
      const twelveMonthsAgo = new Date(now);
      twelveMonthsAgo.setMonth(now.getMonth() - 12);
      dateRange = {
        close_date: {
          gte: twelveMonthsAgo,
          lte: now
        }
      };
    }

    // Get closed won deals with commission (handle case variations)
    const deals = await prisma.deals.findMany({
      where: {
        user_id: targetUserId,
        stage: { in: ['closed_won', 'Closed Won'] },
        ...dateRange
      },
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
      orderBy: { close_date: 'asc' }
    });

    // Get targets for the period
    const targets = await prisma.targets.findMany({
      where: {
        user_id: targetUserId,
        is_active: true,
        OR: [
          {
            period_start: { lte: dateRange.close_date.lte },
            period_end: { gte: dateRange.close_date.gte }
          }
        ]
      },
      orderBy: { period_start: 'asc' }
    });

    // Group deals by period based on period_view
    const periodData = new Map();
    
    for (const deal of deals) {
      const closeDate = new Date(deal.close_date);
      let periodKey, periodStart, periodEnd;

      if (period_view === 'monthly') {
        periodStart = new Date(closeDate.getFullYear(), closeDate.getMonth(), 1);
        periodEnd = new Date(closeDate.getFullYear(), closeDate.getMonth() + 1, 0);
        periodKey = periodStart.toISOString().substring(0, 7);
      } else if (period_view === 'quarterly') {
        const quarter = Math.floor(closeDate.getMonth() / 3);
        periodStart = new Date(closeDate.getFullYear(), quarter * 3, 1);
        periodEnd = new Date(closeDate.getFullYear(), quarter * 3 + 3, 0);
        periodKey = `${closeDate.getFullYear()}-Q${quarter + 1}`;
      } else if (period_view === 'yearly') {
        periodStart = new Date(closeDate.getFullYear(), 0, 1);
        periodEnd = new Date(closeDate.getFullYear(), 11, 31);
        periodKey = closeDate.getFullYear().toString();
      }

      if (!periodData.has(periodKey)) {
        // Find target for this period
        const periodTarget = targets.find(t => 
          new Date(t.period_start) <= periodEnd && 
          new Date(t.period_end) >= periodStart
        );

        periodData.set(periodKey, {
          period_key: periodKey,
          period_start: periodStart,
          period_end: periodEnd,
          user_id: targetUserId,
          user: deal.user,
          deals: [],
          quota_amount: 0,
          actual_amount: 0,
          commission_earned: 0,
          commission_rate: periodTarget?.commission_rate || 0,
          target_id: periodTarget?.id || null,
          deals_count: 0,
          deals_with_commission: 0,
          deals_without_commission: 0
        });

        // Calculate quota for this period
        if (periodTarget) {
          const targetStart = new Date(periodTarget.period_start);
          const targetEnd = new Date(periodTarget.period_end);
          const targetDays = (targetEnd - targetStart) / (1000 * 60 * 60 * 24) + 1;
          
          // Calculate overlap days
          const overlapStart = periodStart > targetStart ? periodStart : targetStart;
          const overlapEnd = periodEnd < targetEnd ? periodEnd : targetEnd;
          const overlapDays = (overlapEnd - overlapStart) / (1000 * 60 * 60 * 24) + 1;
          
          // Pro-rate quota based on overlap
          const quotaProportion = overlapDays / targetDays;
          periodData.get(periodKey).quota_amount = Number(periodTarget.quota_amount) * quotaProportion;
        }
      }

      const period = periodData.get(periodKey);
      period.deals.push(deal);
      period.deals_count++;
      period.actual_amount += Number(deal.amount);
      
      if (deal.commission_amount) {
        period.commission_earned += Number(deal.commission_amount);
        period.deals_with_commission++;
      } else {
        period.deals_without_commission++;
      }
    }

    // Convert to array and calculate attainment
    const commissionData = Array.from(periodData.values()).map(period => ({
      ...period,
      attainment_pct: period.quota_amount > 0 
        ? (period.actual_amount / period.quota_amount) * 100 
        : 0,
      commission_type: 'actual',
      status: period.deals_without_commission > 0 ? 'partial' : 'calculated',
      warning: period.deals_without_commission > 0 
        ? `${period.deals_without_commission} deals missing commission (no active target when closed)`
        : null
    }));

    // Sort by period
    commissionData.sort((a, b) => new Date(a.period_start) - new Date(b.period_start));

    // Format for export if needed
    if (is_export === 'true') {
      const exportData = commissionData.map(c => ({
        Period: c.period_key,
        'Sales Rep': `${c.user.first_name} ${c.user.last_name}`,
        'Quota Amount': c.quota_amount,
        'Actual Sales': c.actual_amount,
        'Attainment %': c.attainment_pct.toFixed(2),
        'Commission Rate': (c.commission_rate * 100).toFixed(2) + '%',
        'Commission Earned': c.commission_earned.toFixed(2),
        'Deals Count': c.deals_count,
        'Status': c.status,
        'Warning': c.warning || ''
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=commission-report.csv');
      
      const csvHeader = Object.keys(exportData[0]).join(',');
      const csvRows = exportData.map(row => 
        Object.values(row).map(v => `"${v}"`).join(',')
      );
      
      return res.send([csvHeader, ...csvRows].join('\n'));
    }

    res.json({
      commissions: commissionData,
      summary: {
        total_periods: commissionData.length,
        total_quota: commissionData.reduce((sum, c) => sum + c.quota_amount, 0),
        total_actual: commissionData.reduce((sum, c) => sum + c.actual_amount, 0),
        total_commission: commissionData.reduce((sum, c) => sum + c.commission_earned, 0),
        overall_attainment: commissionData.reduce((sum, c) => sum + c.quota_amount, 0) > 0
          ? (commissionData.reduce((sum, c) => sum + c.actual_amount, 0) / 
             commissionData.reduce((sum, c) => sum + c.quota_amount, 0)) * 100
          : 0,
        deals_missing_commission: commissionData.reduce((sum, c) => sum + c.deals_without_commission, 0)
      }
    });

  } catch (error) {
    console.error('Get commission data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get team members for commission filtering
router.get('/team-members', async (req, res) => {
  try {
    if (!canManageTeam(req.user)) {
      return res.status(403).json({ error: 'Access denied - managers only' });
    }

    const teamMembers = await prisma.users.findMany({
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
      }
    });

    res.json({
      team_members: teamMembers,
      success: true
    });
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get team commission summary
router.get('/team', async (req, res) => {
  try {
    if (!canManageTeam(req.user)) {
      return res.status(403).json({ error: 'Access denied - managers only' });
    }

    const { period_view = 'quarterly', start_date, end_date } = req.query;

    // Get team members
    const teamMembers = await prisma.users.findMany({
      where: {
        manager_id: req.user.id,
        company_id: req.user.company_id,
        is_active: true
      }
    });

    const teamMemberIds = teamMembers.map(m => m.id);
    teamMemberIds.push(req.user.id); // Include manager

    // Get date range
    let dateRange = {};
    if (start_date && end_date) {
      dateRange = {
        close_date: {
          gte: new Date(start_date),
          lte: new Date(end_date)
        }
      };
    } else {
      const now = new Date();
      const twelveMonthsAgo = new Date(now);
      twelveMonthsAgo.setMonth(now.getMonth() - 12);
      dateRange = {
        close_date: {
          gte: twelveMonthsAgo,
          lte: now
        }
      };
    }

    // Get all team deals (handle case variations)
    const teamDeals = await prisma.deals.findMany({
      where: {
        user_id: { in: teamMemberIds },
        stage: { in: ['closed_won', 'Closed Won'] },
        ...dateRange
      },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    });

    // Get team targets
    const teamTargets = await prisma.targets.findMany({
      where: {
        user_id: { in: teamMemberIds },
        is_active: true,
        OR: [
          {
            period_start: { lte: dateRange.close_date.lte },
            period_end: { gte: dateRange.close_date.gte }
          }
        ]
      }
    });

    // Group by user and period
    const userData = new Map();
    
    for (const deal of teamDeals) {
      const userId = deal.user_id;
      const userKey = `${deal.user.first_name} ${deal.user.last_name}`;
      
      if (!userData.has(userKey)) {
        userData.set(userKey, {
          user: deal.user,
          total_sales: 0,
          total_commission: 0,
          total_quota: 0,
          deals_count: 0,
          attainment_pct: 0
        });
      }

      const userStats = userData.get(userKey);
      userStats.total_sales += Number(deal.amount);
      userStats.deals_count++;
      
      if (deal.commission_amount) {
        userStats.total_commission += Number(deal.commission_amount);
      }
    }

    // Add quota information
    for (const target of teamTargets) {
      const user = teamMembers.find(m => m.id === target.user_id) || 
                   (target.user_id === req.user.id ? req.user : null);
      
      if (user) {
        const userKey = `${user.first_name} ${user.last_name}`;
        if (userData.has(userKey)) {
          userData.get(userKey).total_quota += Number(target.quota_amount);
        }
      }
    }

    // Calculate attainment
    for (const [key, stats] of userData) {
      stats.attainment_pct = stats.total_quota > 0 
        ? (stats.total_sales / stats.total_quota) * 100 
        : 0;
    }

    const teamData = Array.from(userData.values());

    res.json({
      team_members: teamData,
      summary: {
        total_team_sales: teamData.reduce((sum, m) => sum + m.total_sales, 0),
        total_team_commission: teamData.reduce((sum, m) => sum + m.total_commission, 0),
        total_team_quota: teamData.reduce((sum, m) => sum + m.total_quota, 0),
        team_attainment_pct: teamData.reduce((sum, m) => sum + m.total_quota, 0) > 0
          ? (teamData.reduce((sum, m) => sum + m.total_sales, 0) / 
             teamData.reduce((sum, m) => sum + m.total_quota, 0)) * 100
          : 0,
        member_count: teamData.length
      }
    });

  } catch (error) {
    console.error('Get team commission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;