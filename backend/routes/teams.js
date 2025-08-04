// routes/teams.js
import express from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { isAdmin, isManager, canManageTeam } from '../middleware/roleHelpers.js';
import { requireTeamView, requireTeamManagement, attachPermissions } from '../middleware/permissions.js';

const router = express.Router();
const prisma = new PrismaClient();

// Utility function to capitalize names properly
const capitalizeName = (name) => {
  if (!name) return name;
  const result = name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  console.log('🔍 BACKEND - Capitalizing name:', name, '->', result);
  return result;
};

// Attach permissions to all team routes for conditional logic
router.use(attachPermissions);

// Get team members - managers and admins can view
router.get('/', requireTeamView, async (req, res) => {
  try {
    console.log(`🏢 TEAM ENDPOINT called by ${req.user.email} (${req.permissions.level})`);
    
    // Permission already checked by middleware

    // Get period filter (default to quarterly) and active filter
    const { period = 'quarterly', show_inactive = 'false' } = req.query;
    
    // Calculate date range for the period filter
    const now = new Date();
    let startDate, endDate;
    
    if (period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'quarterly') {
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59, 999);
    } else { // yearly
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    }

    // Optimized query to avoid N+1 issues
    const teamMembers = await prisma.users.findMany({
      where: { 
        company_id: req.user.company_id,
        ...(show_inactive === 'false' && { is_active: true })
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        is_admin: true,
        is_manager: true,
        is_active: true,
        hire_date: true,
        territory: true,
        created_at: true,
        manager: {
          select: { first_name: true, last_name: true, email: true }
        },
        team_memberships: {
          where: { is_active: true },
          include: {
            team: {
              select: {
                id: true,
                team_name: true
              }
            }
          }
        },
        _count: {
          select: { reports: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // DEBUG: Log what fields are actually being returned
    console.log('🔍 BACKEND DEBUG - Team members data:', teamMembers.map(member => ({
      email: member.email,
      is_admin: member.is_admin,
      is_manager: member.is_manager,
      role: member.role,
      hasIsAdmin: 'is_admin' in member,
      hasIsManager: 'is_manager' in member
    })));

    // Get aggregated data for all team members in batch queries
    // Include the requesting user (manager) to get their team targets
    const teamMemberIds = [...teamMembers.map(member => member.id), req.user.id];
    
    // Initialize empty data arrays for when there are no team members
    let openDealsData = [];
    let closedWonDealsData = [];
    let commitDealsData = [];
    let bestCaseDealsData = [];
    let targetsData = [];
    let commissionsData = [];
    
    // Only run queries if there are team members
    if (teamMemberIds.length > 0) {
      // Batch query for open deals - filter by expected close date within the period
      openDealsData = await prisma.deals.groupBy({
        by: ['user_id'],
        where: {
          user_id: { in: teamMemberIds },
          status: 'open',
          close_date: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          amount: true
        },
        _count: {
          id: true
        }
      });

      // Batch query for closed won deals - include all closed_won deals for the selected period
      closedWonDealsData = await prisma.deals.groupBy({
        by: ['user_id'],
        where: {
          user_id: { in: teamMemberIds },
          status: 'closed_won',
          OR: [
            {
              // Use actual closed_date if available
              closed_date: {
                gte: startDate,
                lte: endDate
              }
            },
            {
              // If no closed_date, use close_date (expected close date) as fallback
              closed_date: null,
              close_date: {
                gte: startDate,
                lte: endDate
              }
            }
          ]
        },
        _sum: {
          amount: true
        },
        _count: {
          id: true
        }
      });

      // Batch query for active targets with period information
      // Prioritize current quarter child targets over parent targets
      let allTargetsData;
      try {
        // Try with new schema fields first
        allTargetsData = await prisma.targets.findMany({
          where: {
            user_id: { in: teamMemberIds },
            is_active: true,
            AND: [
              { period_start: { lte: endDate } },
              { period_end: { gte: startDate } }
            ]
          },
          select: {
            user_id: true,
            quota_amount: true,
            commission_rate: true,
            period_type: true,
            period_start: true,
            period_end: true,
            team_target: true,
            role: true,
            parent_target_id: true
          }
        });
      } catch (error) {
        console.log('New schema fields not available, falling back to basic target query');
        // Fallback to basic query without new schema fields
        allTargetsData = await prisma.targets.findMany({
          where: {
            user_id: { in: teamMemberIds },
            is_active: true,
            AND: [
              { period_start: { lte: endDate } },
              { period_end: { gte: startDate } }
            ]
          },
          select: {
            user_id: true,
            quota_amount: true,
            commission_rate: true,
            period_type: true,
            period_start: true,
            period_end: true,
            role: true
          }
        });
        
        // Add default values for missing fields
        allTargetsData = allTargetsData.map(target => ({
          ...target,
          team_target: false, // Default to personal target
          parent_target_id: null // Default to parent target
        }));
      }
      
      // Create a map to hold the best target for each user (prefer child targets)
      const userTargetMap = new Map();
      
      // First pass: collect all targets by user
      allTargetsData.forEach(target => {
        if (!userTargetMap.has(target.user_id)) {
          userTargetMap.set(target.user_id, []);
        }
        userTargetMap.get(target.user_id).push(target);
      });
      
      // Second pass: select the best target for each user (prioritize child targets)
      // For managers, include both personal and team targets
      targetsData = [];
      userTargetMap.forEach((targets, userId) => {
        // Separate targets by type
        const childTargets = targets.filter(t => t.parent_target_id !== null && !t.team_target);
        const parentTargets = targets.filter(t => t.parent_target_id === null && !t.team_target);
        const teamTargets = targets.filter(t => t.team_target === true);
        
        // For personal targets: prefer child targets over parent targets
        const selectedPersonalTarget = childTargets.length > 0 ? childTargets[0] : (parentTargets.length > 0 ? parentTargets[0] : null);
        
        if (selectedPersonalTarget) {
          console.log(`🎯 Target selection for user ${userId}: Using ${selectedPersonalTarget.parent_target_id ? 'CHILD' : 'PARENT'} target of £${selectedPersonalTarget.quota_amount} (${selectedPersonalTarget.period_type})`);
          targetsData.push(selectedPersonalTarget);
        }
        
        // For managers: also include team targets
        if (teamTargets.length > 0) {
          const teamTarget = teamTargets[0]; // Take the first team target
          console.log(`🎯 Target selection for user ${userId}: Adding TEAM target of £${teamTarget.quota_amount} (${teamTarget.period_type})`);
          targetsData.push(teamTarget);
        }
      });

      // Batch query for commit deals (categorized as commit by reps)
      commitDealsData = await prisma.deals.findMany({
        where: {
          user_id: { in: teamMemberIds },
          status: 'open',
          close_date: {
            gte: startDate,
            lte: endDate
          },
          deal_categorizations: {
            some: {
              category: 'commit'
            }
          }
        },
        select: {
          user_id: true,
          amount: true
        }
      });

      // Batch query for best case deals (categorized as best_case by reps)
      bestCaseDealsData = await prisma.deals.findMany({
        where: {
          user_id: { in: teamMemberIds },
          status: 'open',
          close_date: {
            gte: startDate,
            lte: endDate
          },
          deal_categorizations: {
            some: {
              category: 'best_case'
            }
          }
        },
        select: {
          user_id: true,
          amount: true
        }
      });

      // Batch query for commissions
      commissionsData = await prisma.commissions.groupBy({
        by: ['user_id'],
        where: {
          user_id: { in: teamMemberIds }
        },
        _sum: {
          commission_earned: true
        }
      });
    }

    // Create lookup maps for O(1) access
    const openDealsMap = new Map(openDealsData.map(d => [d.user_id, d]));
    const closedWonDealsMap = new Map(closedWonDealsData.map(d => [d.user_id, d]));
    const targetsMap = new Map(targetsData.map(t => [t.user_id, t]));
    const commissionsMap = new Map(commissionsData.map(c => [c.user_id, c]));

    // Create lookup maps for categorized deals
    const commitDealsMap = new Map();
    const bestCaseDealsMap = new Map();
    
    commitDealsData.forEach(deal => {
      const userId = deal.user_id;
      if (!commitDealsMap.has(userId)) {
        commitDealsMap.set(userId, { amount: 0, count: 0 });
      }
      const current = commitDealsMap.get(userId);
      current.amount += Number(deal.amount);
      current.count += 1;
    });

    bestCaseDealsData.forEach(deal => {
      const userId = deal.user_id;
      if (!bestCaseDealsMap.has(userId)) {
        bestCaseDealsMap.set(userId, { amount: 0, count: 0 });
      }
      const current = bestCaseDealsMap.get(userId);
      current.amount += Number(deal.amount);
      current.count += 1;
    });

    // Calculate performance metrics using batch data
    const teamWithMetrics = teamMembers.map(member => {
      const openDeals = openDealsMap.get(member.id);
      const closedWonDeals = closedWonDealsMap.get(member.id);
      const commitDeals = commitDealsMap.get(member.id);
      const bestCaseDeals = bestCaseDealsMap.get(member.id);
      // Get manager's targets (could have personal, team, or both)
      const allTargets = targetsData.filter(t => t.user_id === member.id);
      const personalTarget = allTargets.find(t => !t.team_target);
      const teamTarget = allTargets.find(t => t.team_target);
      
      // Default target for basic calculations
      let target = personalTarget || teamTarget;
      const commissions = commissionsMap.get(member.id);
      
      let openDealsAmount = openDeals?._sum?.amount ? Number(openDeals._sum.amount) : 0;
      let closedWonAmount = closedWonDeals?._sum?.amount ? Number(closedWonDeals._sum.amount) : 0;
      let commitAmount = commitDeals?.amount || 0;
      let bestCaseAmount = bestCaseDeals?.amount || 0;
      
      // Prepare personal and team metrics for conditional display
      let personalMetrics = null;
      let teamMetrics = null;
      
      // Personal metrics (if manager has personal target)
      if (personalTarget) {
        // Calculate pro-rated personal quota using the same logic as currentQuota
        const personalTargetStart = new Date(personalTarget.period_start);
        const personalTargetEnd = new Date(personalTarget.period_end);
        const originalPersonalQuota = Number(personalTarget.quota_amount);
        
        let proRatedPersonalQuota = originalPersonalQuota;
        const overlapStart = new Date(Math.max(personalTargetStart.getTime(), startDate.getTime()));
        const overlapEnd = new Date(Math.min(personalTargetEnd.getTime(), endDate.getTime()));
        
        if (overlapStart <= overlapEnd) {
          let proRatio = 1;
          if (personalTarget.period_type === 'annual' && period === 'quarterly') {
            proRatio = 1 / 4;
          } else if (personalTarget.period_type === 'annual' && period === 'monthly') {
            proRatio = 1 / 12;
          } else if (personalTarget.period_type === 'quarterly' && period === 'monthly') {
            proRatio = 1 / 3;
          }
          proRatedPersonalQuota = originalPersonalQuota * proRatio;
        }
        
        personalMetrics = {
          closedAmount: closedWonAmount,
          commitAmount: commitAmount,
          bestCaseAmount: bestCaseAmount,
          pipelineAmount: openDealsAmount,
          quotaAmount: proRatedPersonalQuota,
          commissionRate: Number(personalTarget.commission_rate),
          quotaProgress: closedWonAmount + commitAmount + bestCaseAmount
        };
      }
      
      // Team aggregated metrics (if manager has team target)
      if (teamTarget && member.role === 'manager') {
        // Get all direct reports for this manager
        const directReports = teamMembers.filter(tm => tm.manager?.email === member.email);
        const directReportIds = directReports.map(dr => dr.id);
        
        if (directReportIds.length > 0) {
          // Aggregate team performance data (including manager's personal performance)
          const teamClosedAmount = directReportIds.reduce((sum, userId) => {
            const deals = closedWonDealsMap.get(userId);
            return sum + (deals?._sum?.amount ? Number(deals._sum.amount) : 0);
          }, 0) + closedWonAmount; // Add manager's personal closed deals
          
          const teamCommitAmount = directReportIds.reduce((sum, userId) => {
            const deals = commitDealsMap.get(userId);
            return sum + (deals?.amount || 0);
          }, 0) + commitAmount; // Add manager's personal commit deals
          
          const teamBestCaseAmount = directReportIds.reduce((sum, userId) => {
            const deals = bestCaseDealsMap.get(userId);
            return sum + (deals?.amount || 0);
          }, 0) + bestCaseAmount; // Add manager's personal best case deals
          
          const teamOpenAmount = directReportIds.reduce((sum, userId) => {
            const deals = openDealsMap.get(userId);
            return sum + (deals?._sum?.amount ? Number(deals._sum.amount) : 0);
          }, 0) + openDealsAmount; // Add manager's personal pipeline deals
          
          // Calculate pro-rated team quota using the same logic as currentQuota
          const teamTargetStart = new Date(teamTarget.period_start);
          const teamTargetEnd = new Date(teamTarget.period_end);
          const originalTeamQuota = Number(teamTarget.quota_amount);
          
          let proRatedTeamQuota = originalTeamQuota;
          const teamOverlapStart = new Date(Math.max(teamTargetStart.getTime(), startDate.getTime()));
          const teamOverlapEnd = new Date(Math.min(teamTargetEnd.getTime(), endDate.getTime()));
          
          if (teamOverlapStart <= teamOverlapEnd) {
            let teamProRatio = 1;
            if (teamTarget.period_type === 'annual' && period === 'quarterly') {
              teamProRatio = 1 / 4;
            } else if (teamTarget.period_type === 'annual' && period === 'monthly') {
              teamProRatio = 1 / 12;
            } else if (teamTarget.period_type === 'quarterly' && period === 'monthly') {
              teamProRatio = 1 / 3;
            }
            proRatedTeamQuota = originalTeamQuota * teamProRatio;
          }
          
          // Calculate total team quota (team quota + manager's personal quota if exists)
          let teamQuotaAmount = proRatedTeamQuota;
          if (personalTarget && personalMetrics) {
            // If manager has both personal and team targets, team quota includes their personal pro-rated quota
            teamQuotaAmount = proRatedTeamQuota + personalMetrics.quotaAmount;
          }
          
          teamMetrics = {
            closedAmount: teamClosedAmount,
            commitAmount: teamCommitAmount,
            bestCaseAmount: teamBestCaseAmount,
            pipelineAmount: teamOpenAmount,
            quotaAmount: teamQuotaAmount,
            commissionRate: Number(teamTarget.commission_rate),
            quotaProgress: teamClosedAmount + teamCommitAmount + teamBestCaseAmount,
            teamMemberCount: directReportIds.length + (personalTarget ? 1 : 0) // Include manager if they have personal quota
          };
        }
      }
      
      // Team metrics for non-managers with team targets
      if (teamTarget && member.role !== 'manager' && !teamMetrics) {
        // For team members, show their individual contribution to team target
        const teamTargetStart = new Date(teamTarget.period_start);
        const teamTargetEnd = new Date(teamTarget.period_end);
        const originalTeamQuota = Number(teamTarget.quota_amount);
        
        let proRatedTeamQuota = originalTeamQuota;
        const teamOverlapStart = new Date(Math.max(teamTargetStart.getTime(), startDate.getTime()));
        const teamOverlapEnd = new Date(Math.min(teamTargetEnd.getTime(), endDate.getTime()));
        
        if (teamOverlapStart <= teamOverlapEnd) {
          let teamProRatio = 1;
          if (teamTarget.period_type === 'annual' && period === 'quarterly') {
            teamProRatio = 1 / 4;
          } else if (teamTarget.period_type === 'annual' && period === 'monthly') {
            teamProRatio = 1 / 12;
          } else if (teamTarget.period_type === 'quarterly' && period === 'monthly') {
            teamProRatio = 1 / 3;
          }
          proRatedTeamQuota = originalTeamQuota * teamProRatio;
        }
        
        teamMetrics = {
          closedAmount: closedWonAmount,
          commitAmount: commitAmount,
          bestCaseAmount: bestCaseAmount,
          pipelineAmount: openDealsAmount,
          quotaAmount: proRatedTeamQuota,
          commissionRate: Number(teamTarget.commission_rate),
          quotaProgress: closedWonAmount + commitAmount + bestCaseAmount,
          teamMemberCount: 1 // Individual team member
        };
      }
      
      // Total progress = closed + commit + best case (for quota progress bar)
      const quotaProgressAmount = closedWonAmount + commitAmount + bestCaseAmount;
      // Pipeline amount is separate (for reference in key)
      const pipelineAmount = openDealsAmount;
      
      // Calculate commission earned on-the-fly if we have a target
      let calculatedCommissions = 0;
      if (target && closedWonAmount > 0) {
        calculatedCommissions = closedWonAmount * Number(target.commission_rate);
        console.log(`Commission calculation for ${member.email}: £${closedWonAmount} × ${Number(target.commission_rate)} = £${calculatedCommissions}`);
      } else {
        console.log(`No commission calculation for ${member.email}: target=${!!target}, closedWonAmount=${closedWonAmount}`);
      }
      
      // Calculate quota for the selected period
      let currentQuota = 0;
      let displayPeriod = null;
      
      if (target) {
        const targetStart = new Date(target.period_start);
        const targetEnd = new Date(target.period_end);
        const originalQuota = Number(target.quota_amount);
        
        // Calculate overlap between target period and selected period
        const overlapStart = new Date(Math.max(targetStart.getTime(), startDate.getTime()));
        const overlapEnd = new Date(Math.min(targetEnd.getTime(), endDate.getTime()));
        
        if (overlapStart <= overlapEnd) {
          // If we have a child target (quarterly), use its full amount for quarterly view
          if (target.parent_target_id !== null && target.period_type === 'quarterly' && period === 'quarterly') {
            // This is a quarterly child target - use full amount
            currentQuota = originalQuota;
            console.log(`💰 Using CHILD target full amount: £${currentQuota} for ${member.email}`);
          } else {
            // Calculate pro-rated quota based on period type (fallback for parent targets)
            let proRatio = 1; // Default to full quota
            
            // Calculate pro-rated quota based on period filter
            if (target.period_type === 'annual' && period === 'quarterly') {
              proRatio = 1 / 4; // Annual target, quarterly view
            } else if (target.period_type === 'annual' && period === 'monthly') {
              proRatio = 1 / 12; // Annual target, monthly view
            } else if (target.period_type === 'quarterly' && period === 'monthly') {
              proRatio = 1 / 3; // Quarterly target, monthly view
            } else {
              // Same period type or viewing a larger period than target - show full amount
              proRatio = 1;
            }
            
            currentQuota = originalQuota * proRatio;
          }
          
          // Set display period based on the filter
          displayPeriod = {
            period_type: period,
            period_start: overlapStart.toISOString(),
            period_end: overlapEnd.toISOString()
          };
        }
      }
      
      return {
        id: member.id,
        email: member.email,
        first_name: member.first_name,
        last_name: member.last_name,
        role: member.role,
        is_admin: member.is_admin,
        is_manager: member.is_manager,
        is_active: member.is_active,
        hire_date: member.hire_date,
        territory: member.territory,
        created_at: member.created_at,
        manager: member.manager,
        team_memberships: member.team_memberships,
        reports_count: member._count.reports,
        performance: {
          // Legacy fields for backward compatibility
          open_deals_amount: pipelineAmount,
          closed_won_amount: closedWonAmount,
          commit_amount: commitAmount,
          best_case_amount: bestCaseAmount,
          quota_progress_amount: quotaProgressAmount,
          current_quota: currentQuota,
          total_commissions: calculatedCommissions || (commissions?._sum?.commission_earned ? Number(commissions._sum.commission_earned) : 0),
          open_deals_count: openDeals?._count?.id || 0,
          closed_won_count: closedWonDeals?._count?.id || 0,
          commit_count: commitDeals?.count || 0,
          best_case_count: bestCaseDeals?.count || 0,
          quota_attainment: currentQuota > 0 ? (quotaProgressAmount / currentQuota) * 100 : 0,
          target_period: displayPeriod,
          is_team_target: target?.team_target || false,
          
          // New conditional metrics for dual/single progress meters
          personal_metrics: personalMetrics,
          team_metrics: teamMetrics,
          has_personal_quota: !!personalTarget,
          has_team_quota: !!teamTarget,
          display_mode: personalTarget && teamTarget ? 'dual' : 
                       teamTarget ? 'team_only' : 
                       personalTarget ? 'personal_only' : 'none'
        }
      };
    });

    // Manager is now processed in the main team members loop with both personal and team targets
    console.log(`🎯 Manager processed in main loop - avoiding duplicate tile`);
    
    let finalTeamMembers = teamWithMetrics;

    res.json({
      team_members: finalTeamMembers,
      success: true
    });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Invite team member - admin only
router.post('/invite', requireTeamManagement, async (req, res) => {
  try {
    // Permission already checked by middleware
    console.log('🔍 BACKEND - Invite request body:', req.body);

    const { email, first_name, last_name, is_admin, is_manager, manager_id, team_ids } = req.body;

    // Validate required fields
    if (!email || !first_name || !last_name) {
      console.log('🔍 BACKEND - Missing fields:', { email: !!email, first_name: !!first_name, last_name: !!last_name });
      return res.status(400).json({ 
        error: 'Missing required fields',
        missing: {
          email: !email,
          first_name: !first_name,
          last_name: !last_name
        }
      });
    }

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email }
    });

    if (existingUser) {
      console.log('🔍 BACKEND - User already exists:', email);
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
        email: email.toLowerCase(), // Normalize email to lowercase
        password: hashedPassword,
        first_name: capitalizeName(first_name),
        last_name: capitalizeName(last_name),
        role: 'sales_rep', // Default role for backward compatibility
        is_admin: is_admin || false,
        is_manager: is_manager || false,
        manager_id: manager_id || null,
        company_id: req.user.company_id
      },
      include: {
        manager: {
          select: { first_name: true, last_name: true, email: true }
        }
      }
    });

    // Add user to teams if specified and set team lead as manager if not already set
    if (team_ids && Array.isArray(team_ids) && team_ids.length > 0) {
      let assignedManagerId = manager_id; // Start with explicitly provided manager
      
      for (const team_id of team_ids) {
        try {
          await prisma.team_members.create({
            data: {
              team_id,
              user_id: newUser.id,
              added_by_admin_id: req.user.id,
              is_active: true
            }
          });

          // If no manager assigned yet, try to use team lead as manager
          if (!assignedManagerId) {
            const team = await prisma.teams.findUnique({
              where: { id: team_id },
              select: { team_lead_id: true }
            });
            
            if (team && team.team_lead_id) {
              assignedManagerId = team.team_lead_id; // Use first team's lead as manager
            }
          }
        } catch (err) {
          console.error(`Failed to add user to team ${team_id}:`, err);
        }
      }

      // Update user with assigned manager if we found one
      if (assignedManagerId && assignedManagerId !== manager_id) {
        await prisma.users.update({
          where: { id: newUser.id },
          data: { manager_id: assignedManagerId }
        });
      }
    }

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
          invited_role: 'sales_rep',
          invited_by: req.user.email,
          team_ids: team_ids || []
        },
        success: true
      }
    });

    // Fetch the user with team memberships
    const userWithTeams = await prisma.users.findUnique({
      where: { id: newUser.id },
      include: {
        manager: {
          select: { first_name: true, last_name: true, email: true }
        },
        team_memberships: {
          where: { is_active: true },
          include: {
            team: {
              select: {
                id: true,
                team_name: true
              }
            }
          }
        }
      }
    });

    res.status(201).json({
      user: {
        id: userWithTeams.id,
        email: userWithTeams.email,
        first_name: userWithTeams.first_name,
        last_name: userWithTeams.last_name,
        role: userWithTeams.role,
        is_admin: userWithTeams.is_admin,
        is_manager: userWithTeams.is_manager,
        manager: userWithTeams.manager,
        team_memberships: userWithTeams.team_memberships,
        created_at: userWithTeams.created_at
      },
      temp_password: tempPassword,
      message: 'Team member invited successfully'
    });
  } catch (error) {
    console.error('Team invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update team member - admin only
router.patch('/:userId', requireTeamManagement, async (req, res) => {
  try {
    // Permission already checked by middleware

    const { userId } = req.params;
    const { first_name, last_name, territory, manager_id, is_active, is_admin, is_manager } = req.body;

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
        first_name: first_name ? capitalizeName(first_name) : undefined,
        last_name: last_name ? capitalizeName(last_name) : undefined,
        territory,
        manager_id,
        is_active,
        is_admin,
        is_manager
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
          updated_fields: { first_name, last_name, territory, manager_id, is_active, is_admin, is_manager },
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
        is_admin: updatedUser.is_admin,
        is_manager: updatedUser.is_manager,
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

// Get team aggregation data for a manager
router.get('/manager/:managerId/aggregation', async (req, res) => {
  try {
    const { managerId } = req.params;
    
    // Only managers can view team aggregations
    if (!canManageTeam(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify the manager exists and is in the same company
    const manager = await prisma.users.findUnique({
      where: { 
        id: managerId,
        company_id: req.user.company_id,
        role: 'manager'
      }
    });

    if (!manager) {
      return res.status(404).json({ error: 'Manager not found' });
    }

    // Get all direct reports for this manager
    const directReports = await prisma.users.findMany({
      where: {
        manager_id: managerId,
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

    if (directReports.length === 0) {
      return res.json({
        targets: [],
        performance: [],
        message: 'This manager has no direct reports'
      });
    }

    const directReportIds = directReports.map(report => report.id);

    // Get active targets for all direct reports that overlap with current date
    const now = new Date();
    const allTargets = await prisma.targets.findMany({
      where: {
        user_id: { in: directReportIds },
        is_active: true,
        period_start: { lte: now },
        period_end: { gte: now }
      },
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true,
            email: true
          }
        }
      },
      orderBy: { period_start: 'desc' }
    });

    // Group targets by user and prioritize child targets (quarterly) over parent targets (annual)  
    const userTargetMap = new Map();
    allTargets.forEach(target => {
      const userId = target.user_id;
      if (!userTargetMap.has(userId)) {
        userTargetMap.set(userId, { childTargets: [], parentTargets: [] });
      }
      if (target.parent_target_id !== null) {
        userTargetMap.get(userId).childTargets.push(target);
      } else {
        userTargetMap.get(userId).parentTargets.push(target);
      }
    });

    // Select the best target for each user (prefer child targets for current period)
    const targets = [];
    userTargetMap.forEach((targetGroups, userId) => {
      // Prefer child targets (quarterly) over parent targets (annual)
      const selectedTarget = targetGroups.childTargets.length > 0 
        ? targetGroups.childTargets[0] 
        : (targetGroups.parentTargets.length > 0 ? targetGroups.parentTargets[0] : null);
      
      if (selectedTarget) {
        console.log(`🎯 Team aggregation: User ${selectedTarget.user.email} - Using ${selectedTarget.parent_target_id ? 'CHILD' : 'PARENT'} target of £${selectedTarget.quota_amount} (${selectedTarget.period_type})`);
        targets.push(selectedTarget);
      }
    });

    // Calculate performance data for each team member
    const performanceData = await Promise.all(
      directReportIds.map(async (userId) => {
        // Get the user's current active target to determine period
        const userTarget = targets.find(t => t.user_id === userId);
        
        if (!userTarget) {
          return {
            user_id: userId,
            closed_won_amount: 0,
            commit_amount: 0,
            best_case_amount: 0,
            quota_progress_amount: 0
          };
        }

        const startDate = userTarget.period_start;
        const endDate = userTarget.period_end;

        // Get closed deals
        const closedDeals = await prisma.deals.aggregate({
          where: {
            user_id: userId,
            status: 'closed_won',
            OR: [
              {
                closed_date: {
                  gte: startDate,
                  lte: endDate
                }
              },
              {
                closed_date: null,
                close_date: {
                  gte: startDate,
                  lte: endDate
                }
              }
            ]
          },
          _sum: {
            amount: true
          }
        });

        // Get commit deals (categorized deals in pipeline)
        const commitDeals = await prisma.deals.aggregate({
          where: {
            user_id: userId,
            status: 'open',
            close_date: {
              gte: startDate,
              lte: endDate
            },
            deal_categorizations: {
              some: {
                category: 'commit'
              }
            }
          },
          _sum: {
            amount: true
          }
        });

        // Get best case deals
        const bestCaseDeals = await prisma.deals.aggregate({
          where: {
            user_id: userId,
            status: 'open',
            close_date: {
              gte: startDate,
              lte: endDate
            },
            deal_categorizations: {
              some: {
                category: 'best_case'
              }
            }
          },
          _sum: {
            amount: true
          }
        });

        const closedWonAmount = Number(closedDeals._sum.amount || 0);
        const commitAmount = Number(commitDeals._sum.amount || 0);
        const bestCaseAmount = Number(bestCaseDeals._sum.amount || 0);

        return {
          user_id: userId,
          closed_won_amount: closedWonAmount,
          commit_amount: commitAmount,
          best_case_amount: bestCaseAmount,
          quota_progress_amount: closedWonAmount + commitAmount + bestCaseAmount
        };
      })
    );

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'team_aggregation_viewed',
        entity_type: 'team_aggregation',
        entity_id: managerId,
        context: {
          manager_email: manager.email,
          direct_reports_count: directReports.length,
          targets_count: targets.length
        },
        success: true
      }
    });

    res.json({
      targets: targets,
      performance: performanceData,
      manager: {
        id: manager.id,
        first_name: manager.first_name,
        last_name: manager.last_name,
        email: manager.email
      },
      direct_reports: directReports,
      summary: {
        team_size: directReports.length,
        active_targets: targets.length,
        total_quota: targets.reduce((sum, target) => sum + Number(target.quota_amount), 0),
        total_progress: performanceData.reduce((sum, perf) => sum + perf.quota_progress_amount, 0)
      }
    });

  } catch (error) {
    console.error('Team aggregation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create team aggregated target
router.post('/aggregated-target', async (req, res) => {
  try {
    console.log('Team aggregated target creation request:', req.body);
    console.log('User making request:', { id: req.user.id, email: req.user.email, role: req.user.role });
    
    // Only managers can create team targets
    if (!canManageTeam(req.user)) {
      console.log('Access denied for user:', req.user.email);
      return res.status(403).json({ error: 'Access denied' });
    }

    const { manager_id, total_quota, avg_commission_rate, period_start, period_end, period_type } = req.body;

    // Validate required fields with specific error messages
    const missingFields = [];
    if (!manager_id) missingFields.push('manager_id');
    if (!total_quota) missingFields.push('total_quota');
    if (!avg_commission_rate) missingFields.push('avg_commission_rate');
    if (!period_start) missingFields.push('period_start');
    if (!period_end) missingFields.push('period_end');
    if (!period_type) missingFields.push('period_type');
    
    if (missingFields.length > 0) {
      console.log('Missing required fields:', missingFields);
      console.log('Request body received:', req.body);
      return res.status(400).json({ 
        error: 'Missing required fields', 
        missing_fields: missingFields,
        received_data: req.body
      });
    }

    // Verify the manager exists and is in the same company
    const manager = await prisma.users.findUnique({
      where: { 
        id: manager_id,
        company_id: req.user.company_id,
        role: 'manager'
      }
    });

    if (!manager) {
      console.log('Manager not found:', { 
        manager_id, 
        company_id: req.user.company_id,
        requesting_user: req.user.email 
      });
      return res.status(400).json({ 
        error: 'Manager not found or invalid',
        details: `Manager ${manager_id} not found in company ${req.user.company_id}`
      });
    }

    // Check if a team target already exists for this manager and period
    // Use try-catch to handle case where team_target field doesn't exist yet
    let existingTarget = null;
    try {
      existingTarget = await prisma.targets.findFirst({
        where: {
          user_id: manager_id,
          is_active: true,
          period_start: new Date(period_start),
          period_end: new Date(period_end),
          team_target: true // Flag to indicate this is a team target
        }
      });
    } catch (error) {
      console.log('team_target field not available, falling back to basic duplicate check');
      // If team_target field doesn't exist, just check for basic duplicates
      existingTarget = await prisma.targets.findFirst({
        where: {
          user_id: manager_id,
          is_active: true,
          period_start: new Date(period_start),
          period_end: new Date(period_end)
        }
      });
    }

    if (existingTarget) {
      console.log('Existing team target found, updating instead of creating new one:', existingTarget.id);
      
      // Update the existing team target
      const updatedTarget = await prisma.targets.update({
        where: { id: existingTarget.id },
        data: {
          quota_amount: Number(total_quota),
          commission_rate: Number(avg_commission_rate),
          updated_at: new Date()
        }
      });

      console.log('Team target updated successfully:', updatedTarget.id);
      
      return res.json({
        success: true,
        message: 'Team target updated successfully',
        target: updatedTarget,
        action: 'updated'
      });
    }

    // Create the team target
    // Try to create with team_target field, fallback if field doesn't exist
    let teamTarget;
    try {
      teamTarget = await prisma.targets.create({
        data: {
          user_id: manager_id,
          company_id: req.user.company_id,
          quota_amount: Number(total_quota),
          commission_rate: Number(avg_commission_rate),
          period_start: new Date(period_start),
          period_end: new Date(period_end),
          period_type: period_type,
          is_active: true,
          team_target: true, // Flag to indicate this is a team target
          role: null // Individual target for the manager
        },
        include: {
          user: {
            select: {
              first_name: true,
              last_name: true,
              email: true
            }
          }
        }
      });
    } catch (error) {
      console.log('team_target field not available, creating target without it');
      // If team_target field doesn't exist, create without it
      teamTarget = await prisma.targets.create({
        data: {
          user_id: manager_id,
          company_id: req.user.company_id,
          quota_amount: Number(total_quota),
          commission_rate: Number(avg_commission_rate),
          period_start: new Date(period_start),
          period_end: new Date(period_end),
          period_type: period_type,
          is_active: true,
          role: null // Individual target for the manager
        },
        include: {
          user: {
            select: {
              first_name: true,
              last_name: true,
              email: true
            }
          }
        }
      });
    }

    // Log the creation
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'team_target_created',
        entity_type: 'target',
        entity_id: teamTarget.id,
        context: {
          manager_email: manager.email,
          total_quota: Number(total_quota),
          avg_commission_rate: Number(avg_commission_rate),
          period: { period_start, period_end, period_type },
          created_by: req.user.email
        },
        success: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Team target created successfully',
      target: teamTarget,
      action: 'created'
    });

  } catch (error) {
    console.error('Create team target error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Deactivate team member - admin only
router.delete('/:userId', requireTeamManagement, async (req, res) => {
  try {
    // Permission already checked by middleware

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

    // Clean up relationships when user is deactivated
    
    // 1. Remove as team lead from any teams
    await prisma.teams.updateMany({
      where: { team_lead_id: userId },
      data: { team_lead_id: null }
    });

    // 2. Remove as manager from any direct reports
    await prisma.users.updateMany({
      where: { manager_id: userId },
      data: { manager_id: null }
    });

    // 3. Deactivate team memberships
    await prisma.team_members.updateMany({
      where: { user_id: userId },
      data: { is_active: false }
    });

    // 4. Deactivate any active targets
    await prisma.targets.updateMany({
      where: { 
        user_id: userId,
        is_active: true
      },
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

export default router;