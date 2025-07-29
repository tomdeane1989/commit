// routes/commissions.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { isAdmin, isManager, canManageTeam } from '../middleware/roleHelpers.js';

const router = express.Router();
const prisma = new PrismaClient();

// Calculate commission for a period
router.post('/calculate', async (req, res) => {
  try {
    console.log('🎯 COMMISSIONS CALCULATE ENDPOINT HIT!');
    console.log('🎯 Request URL:', req.url);
    console.log('🎯 Request path:', req.path);
    console.log('🎯 Request body:', req.body);
    const { user_id, period_start, period_end } = req.body;

    const targetUserId = user_id || req.user.id;

    // Check permissions
    if (targetUserId !== req.user.id && !canManageTeam(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Find active target for the period
    console.log('🔍 Looking for target with overlapping period:');
    console.log('🔍 Requested period:', period_start, 'to', period_end);
    console.log('🔍 User ID:', targetUserId);
    
    const target = await prisma.targets.findFirst({
      where: {
        user_id: targetUserId,
        period_start: { lte: new Date(period_end) },
        period_end: { gte: new Date(period_start) },
        is_active: true
      }
    });
    
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
      return res.status(400).json({ 
        error: 'No active target found for this period',
        message: 'Please ensure you have an active target that covers the requested period.',
        requested_period: { period_start, period_end }
      });
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
    
    // Calculate prorated quota amount based on target period and payment schedule
    let proratedQuotaAmount = Number(target.quota_amount);
    
    console.log(`🎯 Target details: period_type=${target.period_type}, payment_schedule=${target.commission_payment_schedule}, quota=${target.quota_amount}`);
    
    if (target.period_type === 'annual' && target.commission_payment_schedule === 'monthly') {
      // For annual targets with monthly payments, divide by 12
      proratedQuotaAmount = Number(target.quota_amount) / 12;
      console.log(`📊 Prorated monthly quota: £${target.quota_amount} / 12 = £${proratedQuotaAmount}`);
    } else if (target.period_type === 'annual' && target.commission_payment_schedule === 'quarterly') {
      // For annual targets with quarterly payments, divide by 4
      proratedQuotaAmount = Number(target.quota_amount) / 4;
      console.log(`📊 Prorated quarterly quota: £${target.quota_amount} / 4 = £${proratedQuotaAmount}`);
    } else {
      console.log(`📊 Using full quota amount: £${proratedQuotaAmount}`);
    }
    
    const quotaAttainmentPercentage = (totalClosedAmount / proratedQuotaAmount) * 100;

    // Create or update commission record
    console.log('🔍 Checking for existing commission record...');
    console.log('🔍 Looking for commission with:', { 
      user_id: targetUserId, 
      target_id: target.id, 
      period_start: period_start, 
      period_end: period_end 
    });
    
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
          quota_amount: proratedQuotaAmount,
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
          quota_amount: proratedQuotaAmount,
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

    res.json({
      commission: commission,
      deal_commissions: dealCommissions,
      summary: {
        closed_deals_count: closedDeals.length,
        total_closed_amount: totalClosedAmount,
        total_commission_earned: totalCommissionEarned,
        quota_attainment_percentage: quotaAttainmentPercentage,
        commission_rate: Number(target.commission_rate)
      }
    });
  } catch (error) {
    console.error('Calculate commission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get commission calculations with manager filtering support
router.get('/', async (req, res) => {
  try {
    const { user_id, status, include_historical, view } = req.query;
    console.log('🔍 COMMISSIONS MIDDLEWARE: ', req.method, req.url, req.path);

    let where = {
      company_id: req.user.company_id,
      ...(status && { status })
    };

    // Manager view filtering
    if (req.user.role === 'manager' && view) {
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
      if (targetUserId !== req.user.id && !canManageTeam(req.user)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      where.user_id = targetUserId;
    }

    // Get user's active target to determine payment schedule
    const activeTargetUserId = req.user.role === 'manager' && view && view !== 'personal' ? req.user.id : (user_id || req.user.id);
    const activeTarget = await prisma.targets.findFirst({
      where: {
        user_id: activeTargetUserId,
        is_active: true
      }
    });

    const commissions = await prisma.commissions.findMany({
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

    // Auto-calculate missing commissions for team members when viewing team data
    if (req.user.role === 'manager' && (view === 'team' || view === 'all') && include_historical === 'true') {
      console.log('🔄 Auto-calculating missing commissions for team members...');
      
      // Get all team members
      const directReports = await prisma.users.findMany({
        where: {
          manager_id: req.user.id,
          company_id: req.user.company_id,
          is_active: true
        },
        select: { id: true, first_name: true, last_name: true, email: true }
      });
      
      // Include manager in 'all' view
      const allUsers = view === 'all' ? [...directReports, { id: req.user.id, first_name: req.user.first_name, last_name: req.user.last_name, email: req.user.email }] : directReports;
      
      console.log(`📊 Checking commission records for ${allUsers.length} team members`);
      
      // Generate last 12 monthly periods
      const periods = [];
      const now = new Date();
      for (let i = 0; i < 12; i++) {
        const targetYear = now.getUTCFullYear();
        let targetMonth = now.getUTCMonth() - i;
        let year = targetYear;
        
        while (targetMonth < 0) {
          targetMonth += 12;
          year -= 1;
        }
        
        const periodStart = new Date(Date.UTC(year, targetMonth, 1));
        const periodEnd = new Date(Date.UTC(year, targetMonth + 1, 0, 23, 59, 59, 999));
        
        // Only include past periods
        if (periodEnd < now) {
          periods.push({
            start: periodStart.toISOString().split('T')[0],
            end: periodEnd.toISOString().split('T')[0],
            year,
            month: targetMonth
          });
        }
      }
      
      // For each user and period, ensure commission record exists
      for (const user of allUsers) {
        for (const period of periods) {
          try {
            // Check if commission already exists
            const existingCommission = await prisma.commissions.findFirst({
              where: {
                user_id: user.id,
                period_start: new Date(period.start),
                period_end: new Date(period.end)
              }
            });
            
            if (!existingCommission) {
              // Check if user has target and deals for this period
              const target = await prisma.targets.findFirst({
                where: {
                  user_id: user.id,
                  period_start: { lte: new Date(period.end) },
                  period_end: { gte: new Date(period.start) },
                  is_active: true
                }
              });
              
              if (target) {
                const closedDeals = await prisma.deals.findMany({
                  where: {
                    user_id: user.id,
                    status: 'closed_won',
                    close_date: {
                      gte: new Date(period.start),
                      lte: new Date(period.end)
                    }
                  }
                });
                
                // Calculate commission (even if zero deals)
                const totalClosedAmount = closedDeals.reduce((sum, deal) => sum + Number(deal.amount), 0);
                const totalCommissionEarned = totalClosedAmount * Number(target.commission_rate);
                
                // Calculate prorated quota
                let proratedQuotaAmount = Number(target.quota_amount);
                if (target.period_type === 'annual' && target.commission_payment_schedule === 'monthly') {
                  proratedQuotaAmount = Number(target.quota_amount) / 12;
                } else if (target.period_type === 'annual' && target.commission_payment_schedule === 'quarterly') {
                  proratedQuotaAmount = Number(target.quota_amount) / 4;
                }
                
                const quotaAttainmentPercentage = proratedQuotaAmount > 0 ? (totalClosedAmount / proratedQuotaAmount) * 100 : 0;
                
                // Create commission record
                const commission = await prisma.commissions.create({
                  data: {
                    user_id: user.id,
                    target_id: target.id,
                    company_id: req.user.company_id,
                    period_start: new Date(period.start),
                    period_end: new Date(period.end),
                    quota_amount: proratedQuotaAmount,
                    actual_amount: totalClosedAmount,
                    attainment_pct: quotaAttainmentPercentage,
                    commission_rate: Number(target.commission_rate),
                    commission_earned: totalCommissionEarned,
                    base_commission: totalCommissionEarned
                  }
                });
                
                // Create deal commission details
                await Promise.all(
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
                
                console.log(`✅ Created commission for ${user.first_name} ${user.last_name} - ${period.start}: £${totalCommissionEarned.toFixed(2)}`);
              }
            }
          } catch (error) {
            console.error(`❌ Failed to create commission for ${user.email} ${period.start}:`, error.message);
          }
        }
      }
      
      console.log('🔄 Finished auto-calculating missing commissions');
    }

    // If historical data is requested, calculate missing periods
    // Look for ANY targets (not just active ones) to determine payment schedule
    if (include_historical === 'true') {
      let paymentSchedule = 'monthly';
      
      // Try to find any target to determine payment schedule
      const anyTarget = activeTarget || await prisma.targets.findFirst({
        where: {
          user_id: activeTargetUserId,
          company_id: req.user.company_id
        },
        orderBy: { created_at: 'desc' }
      });
      
      if (anyTarget) {
        paymentSchedule = anyTarget.commission_payment_schedule || 'monthly';
      }
      
      const periodsToGenerate = paymentSchedule === 'quarterly' ? 4 : 12;
      
      // Generate period suggestions for periods without commissions
      const suggestions = [];
      const now = new Date();
      
      for (let i = 0; i < periodsToGenerate; i++) {
        let periodStart, periodEnd, periodLabel;
        
        if (paymentSchedule === 'quarterly') {
          // Use UTC dates to avoid timezone issues
          const currentYear = now.getUTCFullYear();
          const currentMonth = now.getUTCMonth();
          
          // Calculate the target quarter
          let targetYear = currentYear;
          let targetMonth = currentMonth - (i * 3);
          
          // Handle year boundary
          while (targetMonth < 0) {
            targetMonth += 12;
            targetYear -= 1;
          }
          
          const quarter = Math.floor(targetMonth / 3);
          const quarterStartMonth = quarter * 3;
          
          periodStart = new Date(Date.UTC(targetYear, quarterStartMonth, 1));
          periodEnd = new Date(Date.UTC(targetYear, quarterStartMonth + 3, 0, 23, 59, 59, 999));
          periodLabel = `Q${quarter + 1} ${targetYear}`;
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
        const existingCommission = commissions.find(c => {
          const commissionStart = new Date(c.period_start);
          return commissionStart.getTime() === periodStart.getTime();
        });
        
        if (!existingCommission && periodEnd < now) {
          // Check if there's a target that covers this historical period
          const historicalTarget = await prisma.targets.findFirst({
            where: {
              user_id: activeTargetUserId,
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
      if (req.user.role === 'manager' && (view === 'team' || view === 'all')) {
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
          is_manager: req.user.role === 'manager',
          selected_user_id: user_id || null
        }
      });
    }

    // Team member breakdown for non-historical requests (for team/all views)
    let teamSummary = null;
    if (req.user.role === 'manager' && (view === 'team' || view === 'all')) {
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
      team_summary: teamSummary,
      view_context: {
        current_view: view || 'personal',
        is_manager: req.user.role === 'manager',
        selected_user_id: user_id || null
      }
    });
  } catch (error) {
    console.error('Get commissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve commission calculation
router.patch('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    // Only managers can approve
    if (!canManageTeam(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

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
    // Only managers can access this endpoint
    if (req.user.role !== 'manager') {
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

export default router;