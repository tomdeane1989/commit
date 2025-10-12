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

    // Get date range based on period view
    // Only filter by date if explicitly provided - otherwise show ALL historical data
    let dateRange = {};
    if (start_date && end_date) {
      dateRange = {
        close_date: {
          gte: new Date(start_date),
          lte: new Date(end_date)
        }
      };
    }

    // Get closed won deals with commission (handle case variations)
    const deals = await prisma.deals.findMany({
      where: {
        user_id: targetUserId,
        stage: { in: ['closed_won', 'Closed Won', 'closedwon'] }, // Include HubSpot format
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
        },
        target: {
          select: {
            id: true,
            name: true,
            commission_structure: true,
            performance_gates: true,
            commission_rate: true
          }
        }
      },
      orderBy: { close_date: 'asc' }
    });

    // Get targets for the period - get ALL active targets (no date filtering)
    const targets = await prisma.targets.findMany({
      where: {
        user_id: targetUserId,
        is_active: true
      },
      orderBy: [
        { parent_target_id: 'desc' }, // Prefer child targets (non-null) over parent targets (null)
        { period_start: 'asc' }
      ]
    });

    // Group deals by period based on period_view
    const periodData = new Map();
    
    for (const deal of deals) {
      const closeDate = new Date(deal.close_date);
      let periodKey, periodStart, periodEnd;

      if (period_view === 'monthly') {
        periodStart = new Date(Date.UTC(closeDate.getUTCFullYear(), closeDate.getUTCMonth(), 1));
        periodEnd = new Date(Date.UTC(closeDate.getUTCFullYear(), closeDate.getUTCMonth() + 1, 0));
        periodKey = periodStart.toISOString().substring(0, 7);
      } else if (period_view === 'quarterly') {
        const quarter = Math.floor(closeDate.getUTCMonth() / 3);
        periodStart = new Date(Date.UTC(closeDate.getUTCFullYear(), quarter * 3, 1));
        periodEnd = new Date(Date.UTC(closeDate.getUTCFullYear(), quarter * 3 + 3, 0));
        periodKey = `${closeDate.getUTCFullYear()}-Q${quarter + 1}`;
      } else if (period_view === 'yearly') {
        periodStart = new Date(Date.UTC(closeDate.getUTCFullYear(), 0, 1));
        periodEnd = new Date(Date.UTC(closeDate.getUTCFullYear(), 11, 31));
        periodKey = closeDate.getUTCFullYear().toString();
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
          target_name: periodTarget?.name || null,
          deals_count: 0,
          deals_with_commission: 0,
          deals_without_commission: 0
        });

        // Calculate quota for this period
        if (periodTarget) {
          let quotaAmount = Number(periodTarget.quota_amount);
          
          // If this is a child target (has parent_target_id), it already has the correctly allocated amount
          // including any seasonal adjustments
          if (periodTarget.parent_target_id) {
            // Child targets already have their allocated amounts (including seasonal)
            periodData.get(periodKey).quota_amount = quotaAmount;
          } else {
            // Parent targets need to be divided based on view
            // Note: This simple division won't reflect seasonal allocations
            // Users should create child targets with proper allocations for accurate seasonal quotas
            if (periodTarget.period_type === 'annual') {
              if (period_view === 'monthly') {
                quotaAmount = quotaAmount / 12;
              } else if (period_view === 'quarterly') {
                quotaAmount = quotaAmount / 4;
              }
            } else if (periodTarget.period_type === 'quarterly' && period_view === 'monthly') {
              quotaAmount = quotaAmount / 3;
            }
            
            periodData.get(periodKey).quota_amount = quotaAmount;
          }
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

    // Note: We only show periods that have actual deals
    // Empty periods with targets but no deals are not displayed in the historical view

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
        : null,
      // Include deals as commission_details for frontend compatibility
      commission_details: period.deals.map(deal => ({
        id: deal.id,
        deal: {
          deal_name: deal.deal_name,
          account_name: deal.account_name,
          amount: deal.amount,
          close_date: deal.close_date,
          closed_date: deal.closed_date
        },
        commission_amount: deal.commission_amount || 0
      }))
    }));

    // Sort by period - newest first
    commissionData.sort((a, b) => new Date(b.period_start) - new Date(a.period_start));

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

    // Get date range based on period view
    // Only filter by date if explicitly provided - otherwise show ALL historical data
    let dateRange = {};
    if (start_date && end_date) {
      dateRange = {
        close_date: {
          gte: new Date(start_date),
          lte: new Date(end_date)
        }
      };
    }

    // Get all team deals (handle case variations including HubSpot format)
    const teamDeals = await prisma.deals.findMany({
      where: {
        user_id: { in: teamMemberIds },
        stage: { in: ['closed_won', 'Closed Won', 'closedwon'] }, // Include HubSpot format
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
        },
        target: {
          select: {
            id: true,
            name: true,
            commission_structure: true,
            performance_gates: true,
            commission_rate: true
          }
        }
      }
    });

    // Get team targets - get ALL active targets (no date filtering)
    const teamTargets = await prisma.targets.findMany({
      where: {
        user_id: { in: teamMemberIds },
        is_active: true
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