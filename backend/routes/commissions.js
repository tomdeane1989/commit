// routes/commissions.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { isAdmin, isManager, canManageTeam } from '../middleware/roleHelpers.js';
import { attachPermissions, requireOwnerOrManager, requireCommissionApproval } from '../middleware/permissions.js';

const router = express.Router();
const prisma = new PrismaClient();

// Attach permissions to all routes for conditional logic
router.use(attachPermissions);

// Helper function to aggregate commissions by period
async function aggregateCommissionsByPeriod(commissions, periodView, prismaClient) {
  const aggregatedMap = new Map();
  
  for (const commission of commissions) {
    let periodKey;
    let periodStart, periodEnd;
    
    if (periodView === 'monthly') {
      // For monthly view, break down quarterly/annual commissions into monthly periods
      const start = new Date(commission.period_start);
      const end = new Date(commission.period_end);
      
      // Check if this is already a monthly commission
      const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
      if (daysDiff <= 31) {
        // Already monthly, just add it
        periodKey = `${commission.user_id}-${start.toISOString().substring(0, 7)}`;
        if (!aggregatedMap.has(periodKey)) {
          aggregatedMap.set(periodKey, commission);
        }
      } else {
        // Break down into monthly periods
        const currentDate = new Date(start);
        while (currentDate <= end) {
          const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
          
          // Ensure we don't go beyond the commission period
          const actualStart = monthStart < start ? start : monthStart;
          const actualEnd = monthEnd > end ? end : monthEnd;
          
          periodKey = `${commission.user_id}-${actualStart.toISOString().substring(0, 7)}`;
          
          if (!aggregatedMap.has(periodKey)) {
            // Calculate proportional amounts based on days in month vs total period
            const totalDays = (end - start) / (1000 * 60 * 60 * 24);
            const monthDays = (actualEnd - actualStart) / (1000 * 60 * 60 * 24) + 1;
            const proportion = monthDays / totalDays;
            
            // Get target info to check for seasonal distribution
            const target = await prismaClient.targets.findUnique({
              where: { id: commission.target_id }
            });
            
            let monthlyQuota = Number(commission.quota_amount) * proportion;
            let monthlyCommission = Number(commission.commission_earned) * proportion;
            let monthlyActual = Number(commission.actual_amount) * proportion;
            
            // Check if target has seasonal distribution
            if (target?.distribution_config?.seasonal_allocations) {
              const monthIndex = actualStart.getMonth();
              const allocation = target.distribution_config.seasonal_allocations[monthIndex];
              if (allocation) {
                // Use seasonal allocation percentage
                const yearlyQuota = Number(target.quota_amount);
                monthlyQuota = yearlyQuota * (allocation.percentage / 100);
              }
            }
            
            aggregatedMap.set(periodKey, {
              ...commission,
              id: `${commission.id}-${actualStart.toISOString().substring(0, 7)}`,
              period_start: actualStart,
              period_end: actualEnd,
              quota_amount: monthlyQuota,
              actual_amount: monthlyActual,
              commission_earned: monthlyCommission,
              base_commission: monthlyCommission,
              attainment_pct: monthlyQuota > 0 ? (monthlyActual / monthlyQuota) * 100 : 0
            });
          }
          
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
      }
    } else if (periodView === 'yearly') {
      // Aggregate by year
      const year = new Date(commission.period_start).getFullYear();
      periodKey = `${commission.user_id}-${year}`;
      
      if (!aggregatedMap.has(periodKey)) {
        periodStart = new Date(year, 0, 1);
        periodEnd = new Date(year, 11, 31);
        
        aggregatedMap.set(periodKey, {
          ...commission,
          id: `${commission.user_id}-${year}`,
          period_start: periodStart,
          period_end: periodEnd,
          quota_amount: Number(commission.quota_amount),
          actual_amount: Number(commission.actual_amount),
          commission_earned: Number(commission.commission_earned),
          base_commission: Number(commission.base_commission),
          attainment_pct: Number(commission.attainment_pct)
        });
      } else {
        // Add to existing year
        const existing = aggregatedMap.get(periodKey);
        existing.quota_amount = Number(existing.quota_amount) + Number(commission.quota_amount);
        existing.actual_amount = Number(existing.actual_amount) + Number(commission.actual_amount);
        existing.commission_earned = Number(existing.commission_earned) + Number(commission.commission_earned);
        existing.base_commission = Number(existing.base_commission) + Number(commission.base_commission);
        existing.attainment_pct = existing.quota_amount > 0 ? (existing.actual_amount / existing.quota_amount) * 100 : 0;
      }
    }
  }
  
  return Array.from(aggregatedMap.values()).sort((a, b) => 
    new Date(b.period_start).getTime() - new Date(a.period_start).getTime()
  );
}

// Helper function to calculate commission for a specific user
async function calculateCommissionForUser(req, targetUserId, period_start, period_end) {
  // Find active target for the period
  console.log('🔍 Looking for target with overlapping period:');
  console.log('🔍 Requested period:', period_start, 'to', period_end);
  console.log('🔍 User ID:', targetUserId);
  
  // Find targets that overlap with the requested period
  const targets = await prisma.targets.findMany({
    where: {
      user_id: targetUserId,
      period_start: { lte: new Date(period_end) },
      period_end: { gte: new Date(period_start) },
      is_active: true
    },
    orderBy: [
      { period_type: 'asc' }, // Prioritize quarterly/monthly over annual
      { created_at: 'desc' }
    ]
  });
  
  // Prefer quarterly/monthly targets over annual
  let target = targets.find(t => t.period_type === 'quarterly' || t.period_type === 'monthly');
  if (!target) target = targets[0]; // Fall back to any target (likely annual)
  
  console.log('🔍 Found target:', target ? 'YES' : 'NO');
  if (target) {
    console.log('🔍 Target period:', target.period_start, 'to', target.period_end);
    console.log('🔍 Target fields:', {
      period_type: target.period_type,
      commission_payment_schedule: target.commission_payment_schedule,
      quota_amount: target.quota_amount
    });
  }

  if (!target) {
    console.log('🚫 No target found for period:', period_start, 'to', period_end);
    console.log('🚫 User ID:', targetUserId);
    throw new Error('No active target found for this period');
  }

  // Get closed deals for the period
  console.log('🔍 Looking for closed deals in period:', period_start, 'to', period_end);
  const closedDeals = await prisma.deals.findMany({
    where: {
      user_id: targetUserId,
      status: 'closed_won',
      close_date: {
        gte: new Date(period_start),
        lte: new Date(period_end)
      }
    }
  });

  // Calculate totals
  const totalClosedAmount = closedDeals.reduce((sum, deal) => sum + Number(deal.amount), 0);
  const totalCommissionEarned = totalClosedAmount * Number(target.commission_rate);
  
  // Calculate quota amount - only prorate if using annual target
  let quotaAmount = Number(target.quota_amount);
  
  console.log(`🎯 Target details: period_type=${target.period_type}, payment_schedule=${target.commission_payment_schedule}, quota=${target.quota_amount}`);
  
  // Only prorate annual targets
  if (target.period_type === 'annual') {
    const requestedPeriodDays = (new Date(period_end) - new Date(period_start)) / (1000 * 60 * 60 * 24);
    
    if (requestedPeriodDays <= 31) {
      // Monthly period from annual target
      quotaAmount = Number(target.quota_amount) / 12;
      console.log(`📊 Prorated monthly quota from annual: £${target.quota_amount} / 12 = £${quotaAmount}`);
    } else if (requestedPeriodDays <= 92) {
      // Quarterly period from annual target
      quotaAmount = Number(target.quota_amount) / 4;
      console.log(`📊 Prorated quarterly quota from annual: £${target.quota_amount} / 4 = £${quotaAmount}`);
    }
  } else {
    // Using period-specific target (quarterly/monthly) - no proration needed
    console.log(`📊 Using period-specific quota: £${quotaAmount} (${target.period_type})`);
  }
  
  const quotaAttainmentPercentage = (totalClosedAmount / quotaAmount) * 100;

  // Create or update commission record
  console.log('🔍 Checking for existing commission record...');
  
  let commission = await prisma.commissions.findFirst({
    where: {
      user_id: targetUserId,
      target_id: target.id,
      period_start: new Date(period_start),
      period_end: new Date(period_end)
    }
  });
  
  console.log('🔍 Existing commission found:', commission ? `YES (id: ${commission.id})` : 'NO');

  if (commission) {
    // Update existing commission
    commission = await prisma.commissions.update({
      where: { id: commission.id },
      data: {
        actual_amount: totalClosedAmount,
        commission_earned: totalCommissionEarned,
        attainment_pct: quotaAttainmentPercentage,
        quota_amount: quotaAmount,
        commission_rate: Number(target.commission_rate),
        base_commission: totalCommissionEarned,
        calculated_at: new Date()
      }
    });
  } else {
    // Create new commission
    commission = await prisma.commissions.create({
      data: {
        user_id: targetUserId,
        target_id: target.id,
        company_id: req.user.company_id,
        period_start: new Date(period_start),
        period_end: new Date(period_end),
        quota_amount: quotaAmount,
        actual_amount: totalClosedAmount,
        attainment_pct: quotaAttainmentPercentage,
        commission_rate: Number(target.commission_rate),
        commission_earned: totalCommissionEarned,
        base_commission: totalCommissionEarned
      }
    });
  }

  // Delete existing deal commission details and create new ones
  await prisma.commission_details.deleteMany({
    where: { commission_id: commission.id }
  });

  const dealCommissions = await Promise.all(
    closedDeals.map(deal => 
      prisma.commission_details.create({
        data: {
          deal_id: deal.id,
          commission_id: commission.id,
          commission_amount: Number(deal.amount) * Number(target.commission_rate)
        }
      })
    )
  );

  // Log activity
  await prisma.activity_log.create({
    data: {
      user_id: req.user.id,
      company_id: req.user.company_id,
      action: 'commission_calculated',
      entity_type: 'commission',
      entity_id: commission.id,
      context: {
        period_start,
        period_end,
        total_commission_earned: totalCommissionEarned,
        quota_attainment_percentage: quotaAttainmentPercentage
      },
      success: true
    }
  });

  return {
    commission: commission,
    deal_commissions: dealCommissions,
    summary: {
      closed_deals_count: closedDeals.length,
      total_closed_amount: totalClosedAmount,
      total_commission_earned: totalCommissionEarned,
      quota_attainment_percentage: quotaAttainmentPercentage,
      commission_rate: Number(target.commission_rate)
    }
  };
}

// Calculate commission for a period
router.post('/calculate', async (req, res) => {
  try {
    console.log('🎯 COMMISSIONS CALCULATE ENDPOINT HIT!');
    console.log('🎯 Request URL:', req.url);
    console.log('🎯 Request path:', req.path);
    console.log('🎯 Request body:', req.body);
    console.log('🎯 Request query:', req.query);
    const { user_id, period_start, period_end } = req.body;
    const { view } = req.query; // Get view from query params

    // For team views, calculate for all team members
    if (req.permissions.canManageTeam && view === 'team') {
      const directReports = await prisma.users.findMany({
        where: {
          manager_id: req.user.id,
          company_id: req.user.company_id,
          is_active: true
        },
        select: { id: true }
      });
      
      const results = [];
      for (const member of directReports) {
        try {
          // Calculate commission for each team member
          const result = await calculateCommissionForUser(req, member.id, period_start, period_end);
          if (result) results.push(result);
        } catch (error) {
          console.log(`⚠️ Failed to calculate commission for team member ${member.id}:`, error.message);
        }
      }
      
      return res.json({
        success: true,
        team_results: results,
        message: `Calculated commissions for ${results.length} team members`
      });
    }

    const targetUserId = user_id || req.user.id;

    // Check permissions - use middleware permissions
    if (targetUserId !== req.user.id && !req.permissions.canManageTeam) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Use helper function to calculate commission
    try {
      const result = await calculateCommissionForUser(req, targetUserId, period_start, period_end);
      res.json(result);
    } catch (error) {
      if (error.message === 'No active target found for this period') {
        return res.status(400).json({ 
          error: 'No active target found for this period',
          message: 'Please ensure you have an active target that covers the requested period.',
          requested_period: { period_start, period_end }
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Calculate commission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get commission calculations with manager filtering support
router.get('/', async (req, res) => {
  try {
    const { user_id, status, include_historical, view, period_view = 'quarterly' } = req.query;
    console.log('🔍 COMMISSIONS MIDDLEWARE: ', req.method, req.url, req.path);
    console.log('🔍 Period view requested:', period_view);
    console.log('🔍 Request query params:', req.query);

    let where = {
      company_id: req.user.company_id,
      commission_type: 'actual', // Only show actual commissions, not projected
      ...(status && { status })
    };

    // Manager view filtering - use permissions from middleware
    if (req.permissions.canManageTeam && view) {
      if (view === 'personal') {
        // Manager's own commissions only
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
            commissions: [],
            payment_schedule: 'monthly',
            missing_periods: [],
            team_summary: null,
            view_context: {
              current_view: view,
              is_manager: true,
              selected_user_id: user_id || null
            }
          });
        }
      } else if (view === 'member' && user_id) {
        // Specific team member's commissions - verify they report to this manager
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
        // Manager's commissions + team's commissions
        const directReports = await prisma.users.findMany({
          where: {
            manager_id: req.user.id,
            company_id: req.user.company_id,
            is_active: true
          },
          select: { id: true }
        });
        
        const teamMemberIds = directReports.map(dr => dr.id);
        teamMemberIds.push(req.user.id); // Include manager's own commissions
        where.user_id = { in: teamMemberIds };
      }
    } else {
      // Default behavior: user's own commissions or specific user (with permission check)
      const targetUserId = user_id || req.user.id;
      if (targetUserId !== req.user.id && !req.permissions.canManageTeam) {
        return res.status(403).json({ error: 'Access denied' });
      }
      where.user_id = targetUserId;
    }

    // Get active target to determine payment schedule
    // For team views, check team members' targets to determine common payment schedule
    let activeTarget = null;
    let paymentSchedule = 'monthly'; // default
    
    if (req.permissions.canManageTeam && (view === 'team' || view === 'all')) {
      // For team views, get the most common payment schedule among team members
      const teamTargets = await prisma.targets.findMany({
        where: {
          user_id: { in: where.user_id.in || [] },
          is_active: true
        },
        select: {
          commission_payment_schedule: true
        }
      });
      
      if (teamTargets.length > 0) {
        // Count occurrences of each schedule type
        const scheduleCount = teamTargets.reduce((acc, target) => {
          acc[target.commission_payment_schedule] = (acc[target.commission_payment_schedule] || 0) + 1;
          return acc;
        }, {});
        
        // Get the most common schedule
        paymentSchedule = Object.entries(scheduleCount).reduce((a, b) => 
          scheduleCount[a[0]] > scheduleCount[b[0]] ? a : b
        )[0];
      }
    } else {
      // For personal/member views, use the specific user's target
      const activeTargetUserId = user_id || req.user.id;
      activeTarget = await prisma.targets.findFirst({
        where: {
          user_id: activeTargetUserId,
          is_active: true
        }
      });
      if (activeTarget) {
        paymentSchedule = activeTarget.commission_payment_schedule || 'monthly';
      }
    }

    console.log('🔍 Commission query where clause:', JSON.stringify(where, null, 2));
    
    let commissions = await prisma.commissions.findMany({
      where,
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
            commission_payment_schedule: true,
            period_type: true,
            quota_amount: true,
            commission_rate: true
          }
        },
        commission_details: {
          include: {
            deal: {
              select: {
                id: true,
                deal_name: true,
                account_name: true,
                amount: true,
                close_date: true,
                closed_date: true
              }
            }
          }
        }
      },
      orderBy: { period_start: 'desc' }
    });
    
    // Don't filter out current period - we want to show ongoing quarters
    // Only filter out truly future periods (those that haven't started yet)
    const now = new Date();
    commissions = commissions.filter(commission => {
      const periodStart = new Date(commission.period_start);
      return periodStart <= now;
    });
    
    console.log(`🔍 Found ${commissions.length} commission records before deduplication`);

    // Deduplicate overlapping periods PER USER - prefer periods that match the payment schedule
    const uniqueCommissions = [];
    const coveredPeriodsByUser = new Map(); // Track covered periods per user
    
    // For quarterly payment schedules, prefer quarterly periods (longer)
    // For monthly payment schedules, prefer monthly periods (shorter)
    const preferredPeriodLength = paymentSchedule === 'quarterly' ? 90 : 30; // days
    
    // Sort by user, then by how close the period length is to preferred length, then by date
    commissions.sort((a, b) => {
      // First sort by user
      if (a.user_id !== b.user_id) {
        return a.user_id.localeCompare(b.user_id);
      }
      
      const aLength = (new Date(a.period_end).getTime() - new Date(a.period_start).getTime()) / (1000 * 60 * 60 * 24);
      const bLength = (new Date(b.period_end).getTime() - new Date(b.period_start).getTime()) / (1000 * 60 * 60 * 24);
      
      const aDiff = Math.abs(aLength - preferredPeriodLength);
      const bDiff = Math.abs(bLength - preferredPeriodLength);
      
      if (aDiff !== bDiff) return aDiff - bDiff;
      return new Date(b.period_start).getTime() - new Date(a.period_start).getTime();
    });
    
    for (const commission of commissions) {
      const userId = commission.user_id;
      if (!coveredPeriodsByUser.has(userId)) {
        coveredPeriodsByUser.set(userId, new Set());
      }
      
      const userCoveredMonths = coveredPeriodsByUser.get(userId);
      const startMonth = new Date(commission.period_start).toISOString().substring(0, 7);
      
      if (!userCoveredMonths.has(startMonth)) {
        uniqueCommissions.push(commission);
        // Mark all months in this period as covered FOR THIS USER
        const start = new Date(commission.period_start);
        const end = new Date(commission.period_end);
        while (start <= end) {
          userCoveredMonths.add(start.toISOString().substring(0, 7));
          start.setMonth(start.getMonth() + 1);
        }
      }
    }
    
    // Sort back by date descending
    commissions = uniqueCommissions.sort((a, b) => 
      new Date(b.period_start).getTime() - new Date(a.period_start).getTime()
    );
    
    console.log(`🔍 After deduplication: ${commissions.length} commission records`);
    console.log('🔍 Unique periods:', commissions.map(c => `${c.user.first_name} - ${c.period_start.toISOString().split('T')[0]} to ${c.period_end.toISOString().split('T')[0]}`));

    // Aggregate commissions based on period_view
    if (period_view === 'monthly' || period_view === 'yearly') {
      try {
        console.log(`🔍 Starting ${period_view} aggregation for ${commissions.length} records`);
        commissions = await aggregateCommissionsByPeriod(commissions, period_view, prisma);
        console.log(`🔍 After ${period_view} aggregation: ${commissions.length} commission records`);
        if (commissions.length > 0) {
          console.log('🔍 Aggregated periods:', commissions.map(c => `${c.user?.first_name || 'Unknown'} - ${c.period_start.toISOString().split('T')[0]} to ${c.period_end.toISOString().split('T')[0]}`));
        }
      } catch (error) {
        console.error(`❌ Error during ${period_view} aggregation:`, error);
      }
    }

    // Initialize suggestions array
    let suggestions = [];

    // If historical data is requested, calculate missing periods
    if (include_historical === 'true') {
      // Determine periods to generate based on period_view
      let periodsToGenerate;
      if (period_view === 'monthly') {
        periodsToGenerate = 12; // Show last 12 months
      } else if (period_view === 'yearly') {
        periodsToGenerate = 3; // Show last 3 years
      } else {
        periodsToGenerate = 4; // Show last 4 quarters
      }
      
      const now = new Date();
      
      for (let i = 0; i < periodsToGenerate; i++) {
        let periodStart, periodEnd, periodLabel;
        
        if (period_view === 'yearly') {
          // Generate yearly periods
          const targetYear = now.getFullYear() - i;
          periodStart = new Date(Date.UTC(targetYear, 0, 1));
          periodEnd = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999));
          periodLabel = targetYear.toString();
        } else if (period_view === 'monthly') {
          // Generate monthly periods
          const currentYear = now.getUTCFullYear();
          const currentMonth = now.getUTCMonth();
          
          let targetYear = currentYear;
          let targetMonth = currentMonth - i;
          
          while (targetMonth < 0) {
            targetMonth += 12;
            targetYear -= 1;
          }
          
          periodStart = new Date(Date.UTC(targetYear, targetMonth, 1));
          periodEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59, 999));
          periodLabel = periodStart.toLocaleDateString('en-GB', { 
            month: 'short', 
            year: 'numeric',
            timeZone: 'UTC'
          });
        } else if (period_view === 'quarterly' || paymentSchedule === 'quarterly') {
          // Use UTC dates to avoid timezone issues
          const currentYear = now.getUTCFullYear();
          const currentMonth = now.getUTCMonth();
          
          // Calculate current quarter
          const currentQuarter = Math.floor(currentMonth / 3);
          
          // Calculate the target quarter (going backwards from current quarter)
          let targetYear = currentYear;
          let targetQuarter = currentQuarter - i;
          
          // Handle year boundary
          while (targetQuarter < 0) {
            targetQuarter += 4;
            targetYear -= 1;
          }
          
          const quarterStartMonth = targetQuarter * 3;
          
          periodStart = new Date(Date.UTC(targetYear, quarterStartMonth, 1));
          periodEnd = new Date(Date.UTC(targetYear, quarterStartMonth + 3, 0, 23, 59, 59, 999));
          periodLabel = `Q${targetQuarter + 1} ${targetYear}`;
        } else {
          // Use UTC dates to avoid timezone issues
          const currentYear = now.getUTCFullYear();
          const currentMonth = now.getUTCMonth();
          
          // Calculate the target month
          let targetYear = currentYear;
          let targetMonth = currentMonth - i;
          
          // Handle year boundary
          while (targetMonth < 0) {
            targetMonth += 12;
            targetYear -= 1;
          }
          
          periodStart = new Date(Date.UTC(targetYear, targetMonth, 1));
          periodEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59, 999));
          periodLabel = periodStart.toLocaleDateString('en-GB', { 
            month: 'long', 
            year: 'numeric',
            timeZone: 'UTC'
          });
        }
        
        // Check if commission exists for this period
        // Need to check if any commission overlaps with this period (not just exact match)
        const existingCommission = commissions.find(c => {
          const commissionStart = new Date(c.period_start);
          const commissionEnd = new Date(c.period_end);
          return commissionStart <= periodEnd && commissionEnd >= periodStart;
        });
        
        if (!existingCommission && periodEnd < now) {
          // For team views, we don't check individual targets for missing periods
          // Just mark as calculable since team members may have different targets
          const canCalculate = req.permissions.canManageTeam && (view === 'team' || view === 'all');
          const targetUserId = user_id || req.user.id;
          const historicalTarget = canCalculate ? true : await prisma.targets.findFirst({
            where: {
              user_id: targetUserId,
              company_id: req.user.company_id,
              period_start: { lte: periodEnd },
              period_end: { gte: periodStart },
              is_active: true
            }
          });
          
          suggestions.push({
            period_start: periodStart.toISOString().split('T')[0],
            period_end: periodEnd.toISOString().split('T')[0],
            label: periodLabel,
            can_calculate: !!historicalTarget,
            missing_target: !historicalTarget
          });
        }
      }
      
      // Team member breakdown (for team/all views)
      let teamSummary = null;
      if (req.permissions.canManageTeam && (view === 'team' || view === 'all')) {
        const teamStats = {};
        commissions.forEach(commission => {
          const ownerId = commission.user_id;
          const ownerName = `${commission.user.first_name} ${commission.user.last_name}`;
          
          if (!teamStats[ownerId]) {
            teamStats[ownerId] = {
              user_id: ownerId,
              name: ownerName,
              email: commission.user.email,
              commission_count: 0,
              total_commission_earned: 0,
              total_quota: 0,
              total_actual: 0,
              avg_attainment: 0
            };
          }
          
          teamStats[ownerId].commission_count++;
          teamStats[ownerId].total_commission_earned += Number(commission.commission_earned);
          teamStats[ownerId].total_quota += Number(commission.quota_amount);
          teamStats[ownerId].total_actual += Number(commission.actual_amount);
        });
        
        // Calculate average attainment for each team member
        Object.values(teamStats).forEach(stats => {
          if (stats.total_quota > 0) {
            stats.avg_attainment = (stats.total_actual / stats.total_quota) * 100;
          }
        });
        
        teamSummary = Object.values(teamStats);
      }

      return res.json({
        commissions,
        payment_schedule: paymentSchedule,
        missing_periods: suggestions,
        team_summary: teamSummary,
        view_context: {
          current_view: view || 'personal',
          is_manager: req.permissions.canManageTeam,
          selected_user_id: user_id || null
        }
      });
    }

    // Team member breakdown for non-historical requests (for team/all views)
    let teamSummary = null;
    if (req.permissions.canManageTeam && (view === 'team' || view === 'all')) {
      const teamStats = {};
      commissions.forEach(commission => {
        const ownerId = commission.user_id;
        const ownerName = `${commission.user.first_name} ${commission.user.last_name}`;
        
        if (!teamStats[ownerId]) {
          teamStats[ownerId] = {
            user_id: ownerId,
            name: ownerName,
            email: commission.user.email,
            commission_count: 0,
            total_commission_earned: 0,
            total_quota: 0,
            total_actual: 0,
            avg_attainment: 0
          };
        }
        
        teamStats[ownerId].commission_count++;
        teamStats[ownerId].total_commission_earned += Number(commission.commission_earned);
        teamStats[ownerId].total_quota += Number(commission.quota_amount);
        teamStats[ownerId].total_actual += Number(commission.actual_amount);
      });
      
      // Calculate average attainment for each team member
      Object.values(teamStats).forEach(stats => {
        if (stats.total_quota > 0) {
          stats.avg_attainment = (stats.total_actual / stats.total_quota) * 100;
        }
      });
      
      teamSummary = Object.values(teamStats);
    }

    res.json({
      commissions,
      payment_schedule: paymentSchedule,
      missing_periods: include_historical === 'true' ? suggestions : [],
      team_summary: teamSummary,
      view_context: {
        current_view: view || 'personal',
        is_manager: req.permissions.canManageTeam,
        selected_user_id: user_id || null
      }
    });
  } catch (error) {
    console.error('Get commissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve commission calculation - admin only
router.patch('/:id/approve', requireCommissionApproval, async (req, res) => {
  try {
    const { id } = req.params;

    // Permission already checked by middleware

    const commission = await prisma.commissions.findUnique({
      where: { id }
    });

    if (!commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    const updatedCommission = await prisma.commissions.update({
      where: { id },
      data: { status: 'approved' }
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'commission_approved',
        entity_type: 'commission',
        entity_id: id,
        context: {},
        success: true
      }
    });

    res.json(updatedCommission);
  } catch (error) {
    console.error('Approve commission error:', error);
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
    console.error('Get commission team members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export commissions to CSV
router.get('/export', async (req, res) => {
  try {
    const { start_date, end_date, status } = req.query;
    
    let where = {
      company_id: req.user.company_id
    };

    // Add filters if provided
    if (start_date) {
      where.period_start = { gte: new Date(start_date) };
    }
    if (end_date) {
      where.period_end = { lte: new Date(end_date) };
    }
    if (status) {
      where.status = status;
    }

    // Permission check - admins see all, others see their own
    if (!req.permissions.isAdmin) {
      where.user_id = req.user.id;
    }

    const commissions = await prisma.commissions.findMany({
      where,
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true,
            email: true
          }
        },
        target: {
          select: {
            commission_payment_schedule: true
          }
        }
      },
      orderBy: [
        { period_start: 'desc' },
        { user_id: 'asc' }
      ]
    });

    // Generate CSV headers
    const headers = [
      'Employee Name',
      'Employee Email',
      'Period Start',
      'Period End',
      'Payment Schedule',
      'Quota Amount',
      'Actual Sales',
      'Attainment %',
      'Commission Rate',
      'Base Commission',
      'Bonus Commission',
      'Total Commission',
      'Status',
      'Calculated Date',
      'Approved Date',
      'Approved By'
    ];

    // Generate CSV rows
    const rows = commissions.map(commission => [
      `${commission.user.first_name} ${commission.user.last_name}`,
      commission.user.email,
      new Date(commission.period_start).toLocaleDateString('en-GB'),
      new Date(commission.period_end).toLocaleDateString('en-GB'),
      commission.target.commission_payment_schedule,
      commission.quota_amount,
      commission.actual_amount,
      `${commission.attainment_pct}%`,
      `${(Number(commission.commission_rate) * 100).toFixed(2)}%`,
      commission.base_commission,
      commission.bonus_commission,
      commission.commission_earned,
      commission.status,
      new Date(commission.calculated_at).toLocaleDateString('en-GB'),
      commission.approved_at ? new Date(commission.approved_at).toLocaleDateString('en-GB') : '',
      commission.approved_by || ''
    ]);

    // Generate CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Set response headers for CSV download
    const filename = `commissions_export_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.send(csvContent);

  } catch (error) {
    console.error('Export commissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;