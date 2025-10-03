// routes/targets.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';
import { isAdmin, isManager, canManageTeam } from '../middleware/roleHelpers.js';
import { requireTargetManagement, requireOwnerOrManager, attachPermissions } from '../middleware/permissions.js';
import enhancedCommissionCalculator from '../services/enhancedCommissionCalculator.js';

const router = express.Router();
const prisma = new PrismaClient();

// Attach permissions to all routes for conditional logic
router.use(attachPermissions);

// Helper function to calculate pro-rated quota for mid-year hires
const calculateProRatedQuota = (baseQuota, hireDate, periodStart, periodEnd) => {
  const hireDateObj = new Date(hireDate);
  const periodStartObj = new Date(periodStart);
  const periodEndObj = new Date(periodEnd);
  
  // If hired before the period starts, use full quota
  if (hireDateObj <= periodStartObj) {
    return baseQuota;
  }
  
  // If hired after the period ends, no quota
  if (hireDateObj > periodEndObj) {
    return 0;
  }
  
  // Calculate pro-rated quota based on remaining time in period
  const totalPeriodDays = (periodEndObj - periodStartObj) / (1000 * 60 * 60 * 24);
  const remainingPeriodDays = (periodEndObj - hireDateObj) / (1000 * 60 * 60 * 24);
  
  const proRatedQuota = baseQuota * (remainingPeriodDays / totalPeriodDays);
  
  return Math.round(proRatedQuota);
};

// Helper function to distribute quota based on distribution method
const distributeQuota = (totalQuota, distributionMethod, periodStart, periodEnd, customBreakdown = null, seasonalData = null) => {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  
  switch (distributionMethod) {
    case 'even':
      return distributeEvenQuota(totalQuota, start, end);
    
    case 'seasonal':
      return distributeSeasonalQuota(totalQuota, start, end, seasonalData);
    
    case 'custom':
      return distributeCustomQuota(totalQuota, start, end, customBreakdown);
    
    case 'one-time':
      return distributeOneTimeQuota(totalQuota, start, end);
    
    default:
      return distributeEvenQuota(totalQuota, start, end);
  }
};

// Even distribution (existing logic)
const distributeEvenQuota = (totalQuota, startDate, endDate) => {
  const months = getMonthsInPeriod(startDate, endDate);
  const monthlyQuota = Math.round(totalQuota / months.length);
  
  return months.map((month, index) => ({
    period_start: month.start,
    period_end: month.end,
    quota_amount: index === months.length - 1 
      ? totalQuota - (monthlyQuota * (months.length - 1)) // Adjust last month for rounding
      : monthlyQuota,
    period_type: 'monthly'
  }));
};

// Seasonal distribution with flexible granularity and allocation methods
const distributeSeasonalQuota = (totalQuota, startDate, endDate, seasonalData = null) => {
  if (!seasonalData) {
    // Fallback to even distribution if no seasonal data provided
    return distributeEvenQuota(totalQuota, startDate, endDate);
  }

  const { 
    seasonal_granularity = 'quarterly',
    seasonal_allocation_method = 'percentage',
    seasonal_allocations = {}
  } = seasonalData;

  if (seasonal_granularity === 'quarterly') {
    return distributeSeasonalQuarterly(totalQuota, startDate, endDate, seasonal_allocation_method, seasonal_allocations);
  } else {
    return distributeSeasonalMonthly(totalQuota, startDate, endDate, seasonal_allocation_method, seasonal_allocations);
  }
};

// Quarterly seasonal distribution
const distributeSeasonalQuarterly = (totalQuota, startDate, endDate, allocationMethod, allocations) => {
  const quarters = getQuartersInPeriod(startDate, endDate);
  
  return quarters.map(quarter => {
    let quotaAmount;
    
    if (allocationMethod === 'percentage') {
      const percentage = allocations[quarter.name] || 25; // Default 25% per quarter
      quotaAmount = Math.round(totalQuota * (percentage / 100));
    } else {
      quotaAmount = allocations[quarter.name] || Math.round(totalQuota / 4); // Default even split
    }
    
    return {
      period_start: quarter.start,
      period_end: quarter.end,
      quota_amount: quotaAmount,
      period_type: 'quarterly'
    };
  });
};

// Monthly seasonal distribution
const distributeSeasonalMonthly = (totalQuota, startDate, endDate, allocationMethod, allocations) => {
  const months = getMonthsInPeriod(startDate, endDate);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return months.map((month, index) => {
    const monthStart = new Date(month.start);
    const monthKey = monthNames[monthStart.getMonth()];
    
    let quotaAmount;
    
    if (allocationMethod === 'percentage') {
      const percentage = allocations[monthKey] || (100 / 12); // Default ~8.33% per month
      quotaAmount = Math.round(totalQuota * (percentage / 100));
    } else {
      quotaAmount = allocations[monthKey] || Math.round(totalQuota / 12); // Default even split
    }
    
    return {
      period_start: month.start,
      period_end: month.end,
      quota_amount: quotaAmount,
      period_type: 'monthly'
    };
  });
};

// Custom breakdown with specific amounts for each period
const distributeCustomQuota = (totalQuota, startDate, endDate, customBreakdown) => {
  if (!customBreakdown || !Array.isArray(customBreakdown)) {
    // Fallback to even distribution if no custom breakdown provided
    return distributeEvenQuota(totalQuota, startDate, endDate);
  }
  
  // Validate that custom breakdown adds up to total quota
  const customTotal = customBreakdown.reduce((sum, period) => sum + period.quota_amount, 0);
  if (Math.abs(customTotal - totalQuota) > 1) { // Allow for small rounding differences
    throw new Error(`Custom breakdown total (${customTotal}) doesn't match annual quota (${totalQuota})`);
  }
  
  return customBreakdown.map(period => ({
    period_start: period.period_start,
    period_end: period.period_end,
    quota_amount: period.quota_amount,
    period_type: period.period_type || 'monthly'
  }));
};

// One-time target for a specific period
const distributeOneTimeQuota = (totalQuota, startDate, endDate) => {
  return [{
    period_start: startDate,
    period_end: endDate,
    quota_amount: totalQuota,
    period_type: 'custom'
  }];
};

// Helper function to get months in a period
const getMonthsInPeriod = (startDate, endDate) => {
  const months = [];
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  
  while (current <= end) {
    const monthStart = new Date(current);
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    
    // Adjust first and last months to actual period boundaries
    if (monthStart < startDate) monthStart.setTime(startDate.getTime());
    if (monthEnd > endDate) monthEnd.setTime(endDate.getTime());
    
    months.push({
      start: monthStart.toISOString().split('T')[0],
      end: monthEnd.toISOString().split('T')[0]
    });
    
    current.setMonth(current.getMonth() + 1);
  }
  
  return months;
};

// Helper function to get quarters in a period - ROBUST VERSION
const getQuartersInPeriod = (startDate, endDate) => {
  const quarters = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  console.log(`🔍 getQuartersInPeriod called with: ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`);
  
  // Define precise quarter boundaries using specific dates
  const year = start.getFullYear();
  const quarterDefinitions = [
    { name: 'Q1', startDate: `${year}-01-01`, endDate: `${year}-03-31` },
    { name: 'Q2', startDate: `${year}-04-01`, endDate: `${year}-06-30` },
    { name: 'Q3', startDate: `${year}-07-01`, endDate: `${year}-09-30` },
    { name: 'Q4', startDate: `${year}-10-01`, endDate: `${year}-12-31` }
  ];
  
  // Add next year's quarters if the period spans multiple years
  if (end.getFullYear() > year) {
    const nextYear = year + 1;
    quarterDefinitions.push(
      { name: `Q1 ${nextYear}`, startDate: `${nextYear}-01-01`, endDate: `${nextYear}-03-31` },
      { name: `Q2 ${nextYear}`, startDate: `${nextYear}-04-01`, endDate: `${nextYear}-06-30` },
      { name: `Q3 ${nextYear}`, startDate: `${nextYear}-07-01`, endDate: `${nextYear}-09-30` },
      { name: `Q4 ${nextYear}`, startDate: `${nextYear}-10-01`, endDate: `${nextYear}-12-31` }
    );
  }
  
  for (const quarter of quarterDefinitions) {
    const quarterStart = new Date(quarter.startDate);
    const quarterEnd = new Date(quarter.endDate);
    
    console.log(`  Checking ${quarter.name}: ${quarter.startDate} to ${quarter.endDate}`);
    
    // Check if this quarter overlaps with our target period
    if (quarterStart <= end && quarterEnd >= start) {
      // Calculate the actual intersection
      const actualStart = quarterStart < start ? start : quarterStart;
      const actualEnd = quarterEnd > end ? end : quarterEnd;
      
      console.log(`    ✅ Adding ${quarter.name}: ${actualStart.toISOString().split('T')[0]} to ${actualEnd.toISOString().split('T')[0]}`);
      
      quarters.push({
        name: quarter.name,
        start: actualStart.toISOString().split('T')[0],
        end: actualEnd.toISOString().split('T')[0]
      });
    }
  }
  
  console.log(`🎯 Final quarters: ${quarters.map(q => `${q.name}(${q.start} to ${q.end})`).join(', ')}`);
  return quarters;
};

const targetSchema = Joi.object({
  user_id: Joi.string().optional(),
  company_id: Joi.string().optional(),
  name: Joi.string().optional(),  // Target name/title for identification
  target_type: Joi.string().valid('revenue', 'product', 'category', 'custom').default('revenue'),
  period_type: Joi.string().valid('monthly', 'quarterly', 'annual').required(),
  period_start: Joi.date().required(),
  period_end: Joi.date().required(),
  quota_amount: Joi.number().positive().required(),
  commission_rate: Joi.number().min(0).max(1).required(),
  currency_code: Joi.string().default('GBP'),
  commission_structure: Joi.object().optional(), // Advanced commission rules
  performance_gates: Joi.object().optional(), // Performance gate conditions
  product_category_id: Joi.string().optional(), // For product/category targets
  role: Joi.string().allow(null).optional(),
  team_target: Joi.boolean().optional()
});

// Get all targets - users can see their own, managers can see all
// Now supports multiple concurrent targets per user
router.get('/', async (req, res) => {
  try {
    const { user_id, active_only = 'false', view = 'management', include_overlapping = 'false' } = req.query;
    
    // Auth already checked by parent middleware
    
    // Check permissions - use req.permissions from middleware
    if (user_id && user_id !== req.user.id && !req.permissions.canManageTeam) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let targets;

    if (view === 'current_period') {
      // For forecasting/deals - return current period targets (prioritize child targets)
      const now = new Date();
      const allTargetsWhere = {
        // Admin/Manager can see all targets in their company if no user_id specified
        ...(user_id ? { user_id } : req.permissions.canManageTeam ? { 
          user: { company_id: req.user.company_id } 
        } : { user_id: req.user.id }),
        ...(active_only === 'true' && { is_active: true }),
        // Get targets that are currently active (overlap with current date)
        period_start: { lte: now },
        period_end: { gte: now }
      };

      const allTargets = await prisma.targets.findMany({
        where: allTargetsWhere,
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
        orderBy: { created_at: 'desc' }
      });

      // Group targets by user and prioritize child targets (quarterly) over parent targets (annual)  
      const userTargetMap = new Map();
      allTargets.forEach(target => {
        const userId = target.user_id;
        if (!userTargetMap.has(userId)) {
          userTargetMap.set(userId, { childTargets: [], parentTargets: [] });
        }
        // Handle missing parent_target_id field gracefully
        const parentTargetId = target.parent_target_id !== undefined ? target.parent_target_id : null;
        if (parentTargetId !== null) {
          userTargetMap.get(userId).childTargets.push(target);
        } else {
          userTargetMap.get(userId).parentTargets.push(target);
        }
      });

      // Select the best target for each user (prefer child targets for current period)
      targets = [];
      userTargetMap.forEach((targetGroups, userId) => {
        // Prefer child targets (quarterly) over parent targets (annual)
        const selectedTarget = targetGroups.childTargets.length > 0 
          ? targetGroups.childTargets[0] 
          : (targetGroups.parentTargets.length > 0 ? targetGroups.parentTargets[0] : null);
        
        if (selectedTarget) {
          const parentTargetId = selectedTarget.parent_target_id !== undefined ? selectedTarget.parent_target_id : null;
          console.log(`🎯 Targets endpoint (current_period): User ${selectedTarget.user.email} - Using ${parentTargetId ? 'CHILD' : 'PARENT'} target of £${selectedTarget.quota_amount} (${selectedTarget.period_type})`);
          targets.push(selectedTarget);
        }
      });

    } else {
      // For management tab - return parent targets (so they can be expanded to see children)
      const baseWhere = {
        // Admin/Manager can see all targets in their company if no user_id specified
        ...(user_id ? { user_id } : req.permissions.canManageTeam ? { 
          user: { company_id: req.user.company_id } 
        } : { user_id: req.user.id }),
        ...(active_only === 'true' && { is_active: true })
      };

      try {
        // Try to filter for parent targets only (new schema)
        targets = await prisma.targets.findMany({
          where: {
            ...baseWhere,
            parent_target_id: null // Only parent targets
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
          orderBy: { created_at: 'desc' }
        });
      } catch (error) {
        console.log('New schema fields not available, falling back to basic target query');
        // Fallback for older schema without parent_target_id field
        targets = await prisma.targets.findMany({
          where: baseWhere,
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
          orderBy: { created_at: 'desc' }
        });
      }

      console.log(`🎯 Targets endpoint (management): Found ${targets.length} parent targets for user ${req.user.email}`);
    }

    console.log(`GET targets: Found ${targets.length} targets for user ${req.user.email}`);

    res.json({
      targets,
      success: true
    });
  } catch (error) {
    console.error('Get targets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get team target aggregation
router.get('/team-aggregate', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Only managers can see team aggregates
    if (!canManageTeam(req.user)) {
      return res.status(403).json({ error: 'Access denied - managers only' });
    }

    // Get all team members including the manager
    const teamMembers = await prisma.users.findMany({
      where: {
        OR: [
          { manager_id: req.user.id },
          { id: req.user.id }
        ],
        is_active: true
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true
      }
    });

    const teamMemberIds = teamMembers.map(m => m.id);

    // Get active targets for all team members
    const teamTargets = await prisma.targets.findMany({
      where: {
        user_id: { in: teamMemberIds },
        is_active: true
        // Removed parent_target_id filter to get all active targets
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
      orderBy: { period_start: 'desc' } // Get newest targets first
    });
    
    console.log(`📊 Team Aggregate: Found ${teamTargets.length} active targets for team members`);
    teamTargets.forEach(t => {
      console.log(`  - ${t.user.email}: £${t.quota_amount} (${t.period_type}) ${t.period_start} to ${t.period_end}`);
    });

    // Group targets by period
    const periodMap = new Map();
    
    for (const target of teamTargets) {
      const periodKey = `${target.period_type}_${target.period_start}_${target.period_end}`;
      
      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, {
          period_type: target.period_type,
          period_start: target.period_start,
          period_end: target.period_end,
          commission_rate: target.commission_rate,
          total_quota: 0,
          member_targets: []
        });
      }
      
      const period = periodMap.get(periodKey);
      period.total_quota += Number(target.quota_amount);
      period.member_targets.push({
        user: target.user,
        quota_amount: target.quota_amount,
        target_id: target.id
      });
    }

    // Convert to array
    const teamAggregates = Array.from(periodMap.values()).map(period => ({
      ...period,
      member_count: period.member_targets.length
    }));

    res.json({
      team_aggregates: teamAggregates,
      team_members: teamMembers,
      success: true
    });

  } catch (error) {
    console.error('Get team aggregate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get child targets for a parent target
router.get('/:id/children', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const childTargets = await prisma.targets.findMany({
      where: {
        parent_target_id: id,
        is_active: true
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
      orderBy: { period_start: 'asc' }
    });

    res.json({
      children: childTargets,
      success: true
    });
  } catch (error) {
    console.error('Get child targets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create target - managers and admins only
router.post('/', requireTargetManagement, async (req, res) => {
  try {
    // Permission already checked by middleware

    const { 
      target_type, 
      user_id, 
      role, 
      team_id,
      name,  // Target name/title
      target_category_type = 'revenue',  // revenue, product, category, custom
      currency_code = 'GBP',
      commission_structure,  // Advanced commission rules
      performance_gates,  // Performance gate conditions  
      product_category_id,  // For product/category targets
      period_type, 
      period_start, 
      period_end, 
      quota_amount, 
      commission_rate, 
      commission_payment_schedule, 
      distribution_method = 'even',
      seasonal_granularity,
      seasonal_allocation_method,
      seasonal_allocations,
      custom_breakdown,
      wizard_data,
      allow_overlapping = false  // Allow multiple concurrent targets
    } = req.body;

    console.log('Create target request data:', JSON.stringify(req.body, null, 2));
    console.log('User making request:', req.user.email, req.user.role, req.user.is_admin ? '(ADMIN)' : '');
    console.log('🔍 Distribution data extracted:', {
      distribution_method,
      seasonal_granularity,
      seasonal_allocation_method,
      seasonal_allocations
    });

    // Validate required fields
    if (!target_type || !period_type || !period_start || !period_end || !quota_amount || !commission_rate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate distribution method specific requirements
    if (distribution_method === 'custom' && !custom_breakdown) {
      return res.status(400).json({ error: 'Custom breakdown required for custom distribution method' });
    }

    if (target_type === 'individual' && !user_id) {
      return res.status(400).json({ error: 'User ID required for individual targets' });
    }

    if (target_type === 'role' && !role) {
      return res.status(400).json({ error: 'Role required for role-based targets' });
    }

    if (target_type === 'team' && !team_id) {
      return res.status(400).json({ error: 'Team ID required for team-based targets' });
    }

    let targetUsers = [];

    if (target_type === 'individual') {
      // Validate user exists and is in same company
      const user = await prisma.users.findUnique({
        where: { 
          id: user_id,
          company_id: req.user.company_id
        }
      });

      if (!user) {
        return res.status(400).json({ error: 'User not found' });
      }

      targetUsers = [user];
    } else if (target_type === 'role') {
      // Get all users with the specified role
      targetUsers = await prisma.users.findMany({
        where: {
          company_id: req.user.company_id,
          role: role,
          is_active: true
        }
      });

      if (targetUsers.length === 0) {
        return res.status(400).json({ error: `No active users found with role: ${role}` });
      }
    } else if (target_type === 'team') {
      // Get all users in the specified team
      const teamMembers = await prisma.team_members.findMany({
        where: {
          team_id: team_id,
          is_active: true // Only active team members
        },
        include: {
          user: true
        }
      });

      targetUsers = teamMembers.map(tm => tm.user).filter(u => u.is_active);

      if (targetUsers.length === 0) {
        return res.status(400).json({ error: `No active users found in team: ${team_id}` });
      }
    } else if (target_type === 'all') {
      // Get all active users in the company
      targetUsers = await prisma.users.findMany({
        where: {
          company_id: req.user.company_id,
          is_active: true
        }
      });

      if (targetUsers.length === 0) {
        return res.status(400).json({ error: 'No active users found in the company' });
      }
    }

    const createdTargets = [];
    const skippedUsers = [];

    console.log(`Starting target creation for ${targetUsers.length} users`);

    // Create targets for each user
    for (const targetUser of targetUsers) {
      // Check for overlapping periods
      const overlapping = await prisma.targets.findFirst({
        where: {
          user_id: targetUser.id,
          is_active: true,
          OR: [
            {
              period_start: { lte: new Date(period_end) },
              period_end: { gte: new Date(period_start) }
            }
          ]
        }
      });

      if (overlapping) {
        console.log(`Skipping overlapping target for user ${targetUser.first_name} ${targetUser.last_name}`);
        skippedUsers.push({
          user_id: targetUser.id,
          name: `${targetUser.first_name} ${targetUser.last_name}`,
          email: targetUser.email,
          role: targetUser.role,
          existing_target: {
            id: overlapping.id,
            period_start: overlapping.period_start.toISOString().split('T')[0],
            period_end: overlapping.period_end.toISOString().split('T')[0],
            quota_amount: overlapping.quota_amount,
            commission_rate: overlapping.commission_rate,
            period_type: overlapping.period_type
          },
          proposed_target: {
            period_start: period_start,
            period_end: period_end,
            quota_amount: quota_amount,
            commission_rate: commission_rate,
            period_type: period_type,
            role: target_type === 'role' ? role : null
          }
        });
        console.log(`Added to skippedUsers array. Total skipped: ${skippedUsers.length}`);
        continue;
      }

      // Only deactivate overlapping targets if allow_overlapping is false
      if (!allow_overlapping) {
        console.log(`Checking for overlapping targets for user ${targetUser.email}`);
        console.log(`New target period: ${period_start} to ${period_end}`);
        
        const overlappingTargets = await prisma.targets.findMany({
          where: {
            user_id: targetUser.id,
            is_active: true,
            AND: [
              { period_start: { lte: new Date(period_end) } },
              { period_end: { gte: new Date(period_start) } }
            ]
          }
        });
        
        console.log(`Found ${overlappingTargets.length} overlapping targets for ${targetUser.email}:`);
        overlappingTargets.forEach(target => {
          console.log(`  - Target ${target.id}: ${target.period_start.toISOString().split('T')[0]} to ${target.period_end.toISOString().split('T')[0]}`);
        });
        
        if (overlappingTargets.length > 0) {
          await prisma.targets.updateMany({
            where: {
              user_id: targetUser.id,
              is_active: true,
              AND: [
                { period_start: { lte: new Date(period_end) } },
                { period_end: { gte: new Date(period_start) } }
              ]
            },
            data: {
              is_active: false
            }
          });
          console.log(`Deactivated ${overlappingTargets.length} overlapping targets for ${targetUser.email}`);
        } else {
          console.log(`No overlapping targets found for ${targetUser.email} - keeping existing targets active`);
        }
      } else {
        console.log(`Allowing overlapping targets for ${targetUser.email} as requested`);
      }

      // Get distribution breakdown for this user's quota
      let quotaDistribution;
      
      // Prepare seasonal data object if seasonal distribution is selected
      const seasonalData = distribution_method === 'seasonal' ? {
        seasonal_granularity,
        seasonal_allocation_method,
        seasonal_allocations
      } : null;
      
      console.log(`🔍 About to distribute quota for user ${targetUser.email}:`, {
        quota_amount,
        distribution_method,
        period_start,
        period_end,
        custom_breakdown,
        seasonalData
      });
      
      // For even distribution, we don't need to create child targets, just use simple distribution
      if (distribution_method === 'even') {
        quotaDistribution = [{
          period_start: period_start,
          period_end: period_end,
          quota_amount: quota_amount,
          period_type: period_type
        }];
        console.log(`✅ Even distribution - using single period for ${targetUser.email}`);
      } else {
        try {
          quotaDistribution = distributeQuota(
            quota_amount, 
            distribution_method, 
            period_start, 
            period_end, 
            custom_breakdown,
            seasonalData
          );
          
          console.log(`✅ Quota distribution successful for ${targetUser.email}:`, quotaDistribution);
        } catch (error) {
          console.error(`Error distributing quota for user ${targetUser.email}:`, error);
          skippedUsers.push({
            user_id: targetUser.id,
            name: `${targetUser.first_name} ${targetUser.last_name}`,
            email: targetUser.email,
            role: targetUser.role,
            error: error.message
          });
          continue;
        }
      }

      // Create parent annual target first
      const parentTarget = await prisma.targets.create({
        data: {
          user_id: targetUser.id,
          company_id: req.user.company_id,
          name: name || `${period_type} Target ${period_start} - ${period_end}`,  // Default name if not provided
          target_type: target_category_type,
          currency_code,
          commission_structure,
          performance_gates,
          product_category_id,
          period_type: period_type,
          period_start: new Date(period_start),
          period_end: new Date(period_end),
          quota_amount: quota_amount,
          commission_rate,
          commission_payment_schedule: commission_payment_schedule || 'monthly',
          is_active: true,
          role: target_type === 'role' ? role : null,
          team_id: target_type === 'team' ? team_id : null,
          team_target: false, // Always false for individual user targets, regardless of how they were created
          // Add distribution metadata
          distribution_method: distribution_method || 'even',
          distribution_config: distribution_method !== 'even' && (seasonalData || custom_breakdown) ? {
            ...(seasonalData && { seasonal: seasonalData }),
            ...(custom_breakdown && { custom: custom_breakdown }),
            original_quota: quota_amount,
            created_via_wizard: true
          } : null
        }
      });

      createdTargets.push(parentTarget);

      // Create child targets for each period in the distribution (only for non-even distribution methods)
      if (distribution_method !== 'even' && quotaDistribution && quotaDistribution.length > 1) {
        for (const quotaPeriod of quotaDistribution) {
        // Calculate pro-rated quota if user was hired mid-period
        let finalQuotaAmount = quotaPeriod.quota_amount;
        let proRatedInfo = null;
        
        if (targetUser.hire_date) {
          const proRatedQuota = calculateProRatedQuota(
            quotaPeriod.quota_amount, 
            targetUser.hire_date, 
            quotaPeriod.period_start, 
            quotaPeriod.period_end
          );
          
          if (proRatedQuota !== quotaPeriod.quota_amount) {
            finalQuotaAmount = proRatedQuota;
            proRatedInfo = {
              original_quota: quotaPeriod.quota_amount,
              pro_rated_quota: proRatedQuota,
              hire_date: targetUser.hire_date,
              reason: 'Mid-year hire pro-rating applied'
            };
          }
        }

          // Create child target for this period
          const periodName = quotaPeriod.period_type === 'quarterly' ? 
            `Q${Math.ceil((new Date(quotaPeriod.period_start).getMonth() + 1) / 3)}` : 
            new Date(quotaPeriod.period_start).toLocaleDateString('en-GB', { month: 'short' });
          
          const childTarget = await prisma.targets.create({
            data: {
              user_id: targetUser.id,
              company_id: req.user.company_id,
              name: name ? `${name} - ${periodName}` : `${parentTarget.name} - ${periodName}`,  // Inherit parent name with period
              target_type: target_category_type,
              currency_code,
              commission_structure,
              performance_gates,
              product_category_id,
              period_type: quotaPeriod.period_type,
              period_start: new Date(quotaPeriod.period_start),
              period_end: new Date(quotaPeriod.period_end),
              quota_amount: finalQuotaAmount,
              commission_rate,
              commission_payment_schedule: commission_payment_schedule || 'monthly',
              is_active: true,
              role: target_type === 'role' ? role : null,
              team_id: target_type === 'team' ? team_id : null,
              team_target: false, // Always false for individual user targets, regardless of how they were created
              parent_target_id: parentTarget.id, // Link to parent target
              // Child targets inherit distribution method but are marked as child
              distribution_method: 'child',
              distribution_config: {
                parent_id: parentTarget.id,
                period_name: periodName,
                original_parent_quota: quota_amount,
                ...(proRatedInfo && { pro_rated_info: proRatedInfo })
              }
            }
          });

          // Log activity for child target
          await prisma.activity_log.create({
            data: {
              user_id: req.user.id,
              company_id: req.user.company_id,
              action: 'child_target_created',
              entity_type: 'target',
              entity_id: childTarget.id,
            context: { 
              target_type,
              target_user: `${targetUser.first_name} ${targetUser.last_name}`,
              quota_amount: childTarget.quota_amount,
              original_quota: quotaPeriod.quota_amount,
              period_start: childTarget.period_start,
              period_end: childTarget.period_end,
              parent_target_id: parentTarget.id,
              distribution_method,
              period_type: quotaPeriod.period_type,
              ...(proRatedInfo && { pro_rated: true, pro_rated_info: proRatedInfo }),
              ...(wizard_data && { created_via_wizard: true })
            },
            success: true
          }
          });
        }
      }

      // Log activity for parent target
      await prisma.activity_log.create({
        data: {
          user_id: req.user.id,
          company_id: req.user.company_id,
          action: 'target_created',
          entity_type: 'target',
          entity_id: parentTarget.id,
          context: { 
            target_type,
            target_user: `${targetUser.first_name} ${targetUser.last_name}`,
            quota_amount: parentTarget.quota_amount,
            period_start: parentTarget.period_start,
            period_end: parentTarget.period_end,
            distribution_method,
            period_type: parentTarget.period_type,
            child_targets_created: distribution_method !== 'even' ? quotaDistribution.length : 0,
            ...(wizard_data && { created_via_wizard: true })
          },
          success: true
        }
      });
    }

    console.log(`Loop completed. Created ${createdTargets.length} targets, skipped ${skippedUsers.length} users`);
    
    if (createdTargets.length === 0) {
      console.log('No targets created, returning 400 error with conflict data');
      return res.status(400).json({
        error: 'No targets created. All users already have overlapping active targets for the specified period.',
        skipped_users: skippedUsers,
        message: 'Try selecting a different time period that doesn\'t overlap with existing targets.'
      });
    }

    // Backfill commission for existing closed_won deals
    console.log('💰 Starting commission backfill for newly created targets...');
    const backfillResults = [];
    
    for (const target of createdTargets) {
      // Only backfill for parent targets or single targets (not child targets)
      if (!target.parent_target_id) {
        try {
          const result = await enhancedCommissionCalculator.recalculateForTarget(target.id);
          if (result.updated > 0) {
            backfillResults.push({
              target_id: target.id,
              user_id: target.user_id,
              deals_updated: result.updated
            });
            console.log(`✅ Backfilled commission for ${result.updated} deals for target ${target.id}`);
          }
        } catch (error) {
          console.error(`❌ Error backfilling commission for target ${target.id}:`, error);
        }
      }
    }

    if (backfillResults.length > 0) {
      const totalDealsUpdated = backfillResults.reduce((sum, r) => sum + r.deals_updated, 0);
      console.log(`💰 Commission backfill complete: ${totalDealsUpdated} deals updated across ${backfillResults.length} targets`);
    }

    // Check if any targets were pro-rated
    const proRatedTargets = createdTargets.filter(target => target.pro_rated_info);
    
    res.status(201).json({
      targets: createdTargets,
      message: `Created ${createdTargets.length} target${createdTargets.length !== 1 ? 's' : ''} successfully`,
      ...(skippedUsers.length > 0 && {
        warning: `${skippedUsers.length} user${skippedUsers.length !== 1 ? 's' : ''} skipped due to overlapping targets`,
        skipped_users: skippedUsers
      }),
      ...(proRatedTargets.length > 0 && {
        pro_rated_count: proRatedTargets.length,
        pro_rated_info: `${proRatedTargets.length} target${proRatedTargets.length !== 1 ? 's' : ''} pro-rated for mid-year hires`
      }),
      ...(backfillResults.length > 0 && {
        commission_backfill: {
          targets_processed: backfillResults.length,
          total_deals_updated: backfillResults.reduce((sum, r) => sum + r.deals_updated, 0),
          details: backfillResults
        }
      })
    });
  } catch (error) {
    console.error('❌ Error creating target:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Request body:', JSON.stringify(req.body, null, 2));
    console.error('❌ User info:', {
      id: req.user?.id,
      email: req.user?.email,
      role: req.user?.role,
      company_id: req.user?.company_id
    });
    
    // More specific error messages
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        error: 'Duplicate target - a target already exists for this period',
        details: error.meta?.target 
      });
    } else if (error.code?.startsWith('P')) {
      return res.status(400).json({ 
        error: 'Database validation error',
        details: error.message 
      });
    } else {
      return res.status(500).json({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
});

// Update target
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 Backend - Update target request:', { id, body: req.body });
    const { error, value } = targetSchema.validate(req.body);
    if (error) {
      console.log('🔍 Backend - Validation error:', error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const existingTarget = await prisma.targets.findUnique({
      where: { id }
    });

    if (!existingTarget) {
      return res.status(404).json({ error: 'Target not found' });
    }

    if (existingTarget.user_id !== req.user.id && !canManageTeam(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const target = await prisma.targets.update({
      where: { id },
      data: value
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'target_updated',
        entity_type: 'target',
        entity_id: target.id,
        context: { quota_amount: target.quota_amount },
        success: true
      }
    });

    res.json(target);
  } catch (error) {
    console.error('Update target error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deactivate target
router.patch('/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;

    const existingTarget = await prisma.targets.findUnique({
      where: { id }
    });

    if (!existingTarget) {
      return res.status(404).json({ error: 'Target not found' });
    }

    if (existingTarget.user_id !== req.user.id && !canManageTeam(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Find all child targets that were created from this parent target
    const childTargets = await prisma.targets.findMany({
      where: {
        parent_target_id: id,
        is_active: true
      }
    });
    
    // Check if this is part of a batch of targets created together (same role, period, quota)
    const relatedTargets = await prisma.targets.findMany({
      where: {
        role: existingTarget.role,
        period_start: existingTarget.period_start,
        period_end: existingTarget.period_end,
        quota_amount: existingTarget.quota_amount,
        commission_rate: existingTarget.commission_rate,
        is_active: true,
        NOT: { id } // Exclude the current target
      }
    });

    // Deactivate the main target
    const target = await prisma.targets.update({
      where: { id },
      data: { is_active: false }
    });
    
    // Deactivate all child targets
    let childDeactivated = 0;
    if (childTargets.length > 0) {
      const childUpdate = await prisma.targets.updateMany({
        where: {
          id: { in: childTargets.map(t => t.id) }
        },
        data: { is_active: false }
      });
      childDeactivated = childUpdate.count;
      console.log(`Deactivated ${childDeactivated} child targets for parent ${id}`);
    }

    // If there are related targets from the same role-based creation, deactivate them too
    let batchDeactivated = 0;
    if (existingTarget.role && relatedTargets.length > 0) {
      const batchUpdate = await prisma.targets.updateMany({
        where: {
          id: { in: relatedTargets.map(t => t.id) }
        },
        data: { is_active: false }
      });
      batchDeactivated = batchUpdate.count;
    }

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'target_deactivated',
        entity_type: 'target',
        entity_id: target.id,
        context: { 
          batch_deactivated: batchDeactivated,
          child_deactivated: childDeactivated,
          ...(batchDeactivated > 0 && { message: `Deactivated ${batchDeactivated + 1} related targets` }),
          ...(childDeactivated > 0 && { child_message: `Deactivated ${childDeactivated} child targets` })
        },
        success: true
      }
    });

    const totalDeactivated = 1 + batchDeactivated + childDeactivated;
    res.json({
      ...target,
      batch_info: (batchDeactivated > 0 || childDeactivated > 0) ? {
        total_deactivated: totalDeactivated,
        message: `Deactivated ${totalDeactivated} targets total`,
        details: {
          main: 1,
          related: batchDeactivated,
          children: childDeactivated
        }
      } : null
    });
  } catch (error) {
    console.error('Deactivate target error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resolve conflicts by replacing existing targets
router.post('/resolve-conflicts', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Only managers (including admins) can resolve conflicts
    if (!canManageTeam(req.user)) {
      return res.status(403).json({ error: 'Only managers can resolve conflicts' });
    }

    const { conflicts, wizard_data } = req.body;
    
    console.log('Resolve conflicts called with:', JSON.stringify(req.body, null, 2));
    
    if (!conflicts || !Array.isArray(conflicts)) {
      return res.status(400).json({ error: 'Conflicts array is required' });
    }

    const resolvedTargets = [];
    const errors = [];

    console.log(`Starting conflict resolution for ${conflicts.length} conflicts`);

    for (const conflict of conflicts) {
      const { user_id, action, existing_target_id, proposed_target } = conflict;
      
      console.log(`Processing conflict for user ${user_id}, action: ${action}`);
      
      if (action === 'replace') {
        try {
          console.log(`  - Deactivating existing target: ${existing_target_id}`);
          // Deactivate existing target
          await prisma.targets.update({
            where: { id: existing_target_id },
            data: { is_active: false }
          });

          console.log(`  - Fetching user data for: ${user_id}`);
          // Calculate pro-rated quota if needed
          const targetUser = await prisma.users.findUnique({
            where: { id: user_id }
          });

          let finalQuotaAmount = proposed_target.quota_amount;
          let proRatedInfo = null;
          
          if (targetUser?.hire_date) {
            const proRatedQuota = calculateProRatedQuota(
              proposed_target.quota_amount,
              targetUser.hire_date,
              proposed_target.period_start,
              proposed_target.period_end
            );
            
            if (proRatedQuota !== proposed_target.quota_amount) {
              finalQuotaAmount = proRatedQuota;
              proRatedInfo = {
                original_quota: proposed_target.quota_amount,
                pro_rated_quota: proRatedQuota,
                hire_date: targetUser.hire_date,
                reason: 'Mid-year hire pro-rating applied'
              };
            }
          }

          console.log(`  - Creating new target for user ${user_id} with quota ${finalQuotaAmount}`);
          // Create new target
          const newTarget = await prisma.targets.create({
            data: {
              user_id: user_id,
              company_id: req.user.company_id,
              period_type: proposed_target.period_type,
              period_start: new Date(proposed_target.period_start),
              period_end: new Date(proposed_target.period_end),
              quota_amount: finalQuotaAmount,
              commission_rate: proposed_target.commission_rate,
              commission_payment_schedule: proposed_target.commission_payment_schedule || 'monthly',
              is_active: true,
              role: proposed_target.role || null,
              team_target: false, // Always false for individual user targets
              team_id: proposed_target.target_type === 'team' ? proposed_target.team_id : null,
              // Add distribution metadata for conflict resolution
              distribution_method: proposed_target.distribution_method || 'even',
              distribution_config: proposed_target.distribution_config || null
            }
          });

          console.log(`  - Successfully created target: ${newTarget.id}`);
          resolvedTargets.push(newTarget);

          // Log activity
          await prisma.activity_log.create({
            data: {
              user_id: req.user.id,
              company_id: req.user.company_id,
              action: 'target_conflict_resolved',
              entity_type: 'target',
              entity_id: newTarget.id,
              context: {
                action: 'replace',
                replaced_target_id: existing_target_id,
                user_name: targetUser ? `${targetUser.first_name} ${targetUser.last_name}` : 'Unknown',
                quota_amount: newTarget.quota_amount,
                original_quota: proposed_target.quota_amount,
                ...(proRatedInfo && { pro_rated: true, pro_rated_info: proRatedInfo })
              },
              success: true
            }
          });

        } catch (error) {
          console.error(`Error resolving conflict for user ${user_id}:`, error);
          errors.push({
            user_id,
            error: 'Failed to resolve conflict',
            details: error.message
          });
        }
      } else if (action === 'keep') {
        // Just log that we kept the existing target
        await prisma.activity_log.create({
          data: {
            user_id: req.user.id,
            company_id: req.user.company_id,
            action: 'target_conflict_resolved',
            entity_type: 'target',
            entity_id: existing_target_id,
            context: {
              action: 'keep',
              user_id: user_id,
              message: 'Kept existing target, rejected proposed target'
            },
            success: true
          }
        });
      } else if (action === 'concurrent') {
        try {
          console.log(`  - Creating concurrent target for user ${user_id} alongside existing target ${existing_target_id}`);
          
          // Fetch user data for pro-rating calculation
          const targetUser = await prisma.users.findUnique({
            where: { id: user_id }
          });

          let finalQuotaAmount = proposed_target.quota_amount;
          let proRatedInfo = null;
          
          if (targetUser?.hire_date) {
            const proRatedQuota = calculateProRatedQuota(
              proposed_target.quota_amount,
              targetUser.hire_date,
              proposed_target.period_start,
              proposed_target.period_end
            );
            
            if (proRatedQuota !== proposed_target.quota_amount) {
              finalQuotaAmount = proRatedQuota;
              proRatedInfo = {
                original_quota: proposed_target.quota_amount,
                pro_rated_quota: proRatedQuota,
                hire_date: targetUser.hire_date,
                reason: 'Mid-year hire pro-rating applied'
              };
            }
          }

          // Create new target without deactivating existing one
          const newTarget = await prisma.targets.create({
            data: {
              user_id: user_id,
              company_id: req.user.company_id,
              period_type: proposed_target.period_type,
              period_start: new Date(proposed_target.period_start),
              period_end: new Date(proposed_target.period_end),
              quota_amount: finalQuotaAmount,
              commission_rate: proposed_target.commission_rate,
              commission_payment_schedule: proposed_target.commission_payment_schedule || 'monthly',
              is_active: true,
              role: proposed_target.role || null,
              team_target: false, // Always false for individual user targets
              team_id: proposed_target.target_type === 'team' ? proposed_target.team_id : null,
              // Add distribution metadata for concurrent targets
              distribution_method: proposed_target.distribution_method || 'even',
              distribution_config: proposed_target.distribution_config || null
            }
          });

          console.log(`  - Successfully created concurrent target: ${newTarget.id}`);
          resolvedTargets.push(newTarget);

          // Log activity
          await prisma.activity_log.create({
            data: {
              user_id: req.user.id,
              company_id: req.user.company_id,
              action: 'target_conflict_resolved',
              entity_type: 'target',
              entity_id: newTarget.id,
              context: {
                action: 'concurrent',
                concurrent_with_target_id: existing_target_id,
                user_name: targetUser ? `${targetUser.first_name} ${targetUser.last_name}` : 'Unknown',
                quota_amount: newTarget.quota_amount,
                original_quota: proposed_target.quota_amount,
                message: 'Created concurrent target alongside existing target',
                ...(proRatedInfo && { pro_rated: true, pro_rated_info: proRatedInfo })
              },
              success: true
            }
          });

        } catch (error) {
          console.error(`Error creating concurrent target for user ${user_id}:`, error);
          errors.push({
            user_id,
            error: 'Failed to create concurrent target',
            details: error.message
          });
        }
      }
    }

    const proRatedTargets = resolvedTargets.filter(target => target.pro_rated_info);

    console.log(`Conflict resolution completed: ${resolvedTargets.length} targets created, ${errors.length} errors`);

    res.status(201).json({
      message: `Resolved ${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''} successfully`,
      resolved_targets: resolvedTargets,
      created_count: resolvedTargets.length,
      errors: errors,
      ...(proRatedTargets.length > 0 && {
        pro_rated_count: proRatedTargets.length,
        pro_rated_info: `${proRatedTargets.length} target${proRatedTargets.length !== 1 ? 's' : ''} pro-rated for mid-year hires`
      })
    });

  } catch (error) {
    console.error('Resolve conflicts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete all targets for a team (parent and child targets)
router.delete('/team/:userId/all', requireTargetManagement, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verify the user exists and belongs to the same company
    const targetUser = await prisma.users.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        email: true, 
        company_id: true,
        is_manager: true,
        is_admin: true
      }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If this is a manager/admin, get all their team members
    let userIdsToDelete = [userId];
    
    if (targetUser.is_manager || targetUser.is_admin) {
      // Get teams where this user is the team lead
      const teamsLed = await prisma.teams.findMany({
        where: {
          team_lead_id: userId,
          is_active: true
        },
        include: {
          team_members: {
            where: { is_active: true },
            select: { user_id: true }
          }
        }
      });

      // Collect all team member IDs
      const teamMemberIds = new Set([userId]); // Include the manager
      teamsLed.forEach(team => {
        team.team_members.forEach(member => {
          teamMemberIds.add(member.user_id);
        });
      });
      
      userIdsToDelete = Array.from(teamMemberIds);
    }

    // Delete all targets (parent and child) for these users
    const deletedTargets = await prisma.targets.deleteMany({
      where: {
        user_id: { in: userIdsToDelete }
      }
    });

    console.log(`Deleted ${deletedTargets.count} targets for ${userIdsToDelete.length} users (team lead: ${targetUser.email})`);

    res.json({ 
      success: true, 
      message: `Successfully deleted ${deletedTargets.count} targets for ${userIdsToDelete.length} team member(s)`,
      deletedCount: deletedTargets.count,
      affectedUsers: userIdsToDelete.length
    });

  } catch (error) {
    console.error('Delete team targets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;