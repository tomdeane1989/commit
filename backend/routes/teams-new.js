// routes/teams-new.js - Team-based approach replacing the old role-based system
import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Helper function to check if user can manage a specific team
const canManageTeam = async (user, teamId) => {
  if (user.is_admin) return true;
  
  // Check if user is the team lead
  const team = await prisma.teams.findFirst({
    where: {
      id: teamId,
      team_lead_id: user.id,
      is_active: true
    }
  });
  
  return !!team;
};

// Helper function to get teams user can view
const getViewableTeams = async (user) => {
  if (user.is_admin) {
    // Admins can see all teams in their company
    return await prisma.teams.findMany({
      where: {
        company_id: user.company_id,
        is_active: true
      }
    });
  }
  
  // Non-admins can only see teams they lead or are members of
  return await prisma.teams.findMany({
    where: {
      company_id: user.company_id,
      is_active: true,
      OR: [
        { team_lead_id: user.id },
        {
          team_members: {
            some: {
              user_id: user.id,
              is_active: true
            }
          }
        }
      ]
    }
  });
};

// GET /api/teams-new - Get team data with members and metrics (team-based)
router.get('/', async (req, res) => {
  try {
    console.log(`🏢 TEAM-BASED ENDPOINT called by ${req.user.email}`);
    
    const { period = 'quarterly', show_inactive = 'false', team_id } = req.query;
    console.log(`🔍 Team endpoint - period filter: ${period}, team filter: ${team_id || 'all'}`);
    
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

    // Get teams user can view
    let teams = await getViewableTeams(req.user);
    
    // Filter by specific team if requested
    if (team_id) {
      teams = teams.filter(team => team.id === team_id);
      
      // Check permissions for specific team
      if (teams.length === 0) {
        return res.status(403).json({ error: 'Access denied to this team' });
      }
    }

    const teamData = [];

    for (const team of teams) {
      console.log(`📋 Processing team: ${team.team_name}`);
      
      // Get team members with their effective roles
      const teamMembers = await prisma.team_members.findMany({
        where: {
          team_id: team.id,
          ...(show_inactive === 'false' && { is_active: true })
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
              role: true,
              sub_role: true,
              is_admin: true,
              is_manager: true,
              is_active: true,
              hire_date: true,
              created_at: true
            }
          }
        },
        orderBy: { joined_date: 'asc' }
      });

      const teamMemberIds = teamMembers.map(tm => tm.user.id);
      
      // Get targets for team members
      const allTargetsData = await prisma.targets.findMany({
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
          parent_target_id: true
        }
      });

      // Get deals data for team members  
      const dealsData = await prisma.deals.findMany({
        where: {
          user_id: { in: teamMemberIds }
        },
        include: {
          deal_categorizations: {
            orderBy: { created_at: 'desc' },
            take: 1
          }
        }
      });

      // Group deals by user and category
      const dealsByUser = new Map();
      dealsData.forEach(deal => {
        if (!dealsByUser.has(deal.user_id)) {
          dealsByUser.set(deal.user_id, {
            closed_won: [],
            commit: [],
            best_case: [],
            pipeline: []
          });
        }
        
        const userDeals = dealsByUser.get(deal.user_id);
        if (deal.status === 'closed_won') {
          userDeals.closed_won.push(deal);
        } else if (deal.deal_categorizations.length > 0) {
          const category = deal.deal_categorizations[0].category;
          if (category === 'commit') {
            userDeals.commit.push(deal);
          } else if (category === 'best_case') {
            userDeals.best_case.push(deal);
          } else {
            userDeals.pipeline.push(deal);
          }
        } else {
          userDeals.pipeline.push(deal);
        }
      });

      // Process each team member
      const processedMembers = teamMembers.map(teamMember => {
        const user = teamMember.user;
        const userDeals = dealsByUser.get(user.id) || { closed_won: [], commit: [], best_case: [], pipeline: [] };
        
        // Get effective role (team override or user default)
        const effectiveRole = teamMember.role_override || team.default_role || user.role;
        const effectiveSubRole = teamMember.sub_role_override || team.default_sub_role || user.sub_role;
        
        // Calculate deal amounts
        const closedWonAmount = userDeals.closed_won.reduce((sum, deal) => sum + Number(deal.amount), 0);
        const commitAmount = userDeals.commit.reduce((sum, deal) => sum + Number(deal.amount), 0);
        const bestCaseAmount = userDeals.best_case.reduce((sum, deal) => sum + Number(deal.amount), 0);
        const pipelineAmount = userDeals.pipeline.reduce((sum, deal) => sum + Number(deal.amount), 0);
        
        // Get target for this user
        const userTargets = allTargetsData.filter(t => t.user_id === user.id);
        const personalTarget = userTargets.find(t => !t.team_target);
        const teamTarget = userTargets.find(t => t.team_target);
        
        const target = personalTarget || teamTarget;
        let quotaAmount = 0;
        let commissionRate = 0;
        
        if (target) {
          quotaAmount = Number(target.quota_amount);
          commissionRate = Number(target.commission_rate);
          
          // Pro-rate quota if needed based on period
          if (target.period_type === 'annual' && period === 'quarterly') {
            quotaAmount = quotaAmount / 4;
          } else if (target.period_type === 'annual' && period === 'monthly') {
            quotaAmount = quotaAmount / 12;
          }
        }
        
        const quotaProgress = closedWonAmount + commitAmount + bestCaseAmount;
        const quotaAttainment = quotaAmount > 0 ? (quotaProgress / quotaAmount) * 100 : 0;
        
        // Calculate commission
        const calculatedCommissions = closedWonAmount * commissionRate;
        
        return {
          // User info with team context
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          
          // Effective roles (team-based)
          role: effectiveRole,
          sub_role: effectiveSubRole,
          team_role_override: teamMember.role_override,
          team_sub_role_override: teamMember.sub_role_override,
          
          // Team membership info
          team_id: team.id,
          team_name: team.team_name,
          joined_date: teamMember.joined_date,
          is_team_lead: team.team_lead_id === user.id,
          
          // Permissions
          is_admin: user.is_admin,
          is_manager: user.is_manager,
          is_active: user.is_active,
          
          // Management info (calculate reports across company, not just current team)
          reports_count: 0, // Will be calculated after this map
          
          // Performance metrics
          closed_won_amount: closedWonAmount,
          commit_amount: commitAmount,
          best_case_amount: bestCaseAmount,
          pipeline_amount: pipelineAmount,
          
          // Target info
          quota_amount: quotaAmount,
          commission_rate: commissionRate,
          quota_progress: quotaProgress,
          quota_attainment: quotaAttainment,
          
          // Commission info
          calculated_commissions: calculatedCommissions,
          
          // Deal counts
          closed_won_count: userDeals.closed_won.length,
          commit_count: userDeals.commit.length,
          best_case_count: userDeals.best_case.length,
          pipeline_count: userDeals.pipeline.length,
          
          // Target metadata
          has_personal_quota: !!personalTarget,
          has_team_quota: !!teamTarget,
          target_period: target ? target.period_type : null
        };
      });

      // Calculate reports_count for each member (across entire company)
      for (const member of processedMembers) {
        const reportsCount = await prisma.users.count({
          where: { 
            manager_id: member.id,
            company_id: req.user.company_id // Only count within same company
          }
        });
        member.reports_count = reportsCount;
      }

      // Calculate team aggregation for team lead
      const teamLead = processedMembers.find(member => member.is_team_lead);
      if (teamLead) {
        const teamMembers = processedMembers.filter(member => !member.is_team_lead);
        
        const teamMetrics = {
          team_closed_amount: teamMembers.reduce((sum, member) => sum + member.closed_won_amount, 0),
          team_commit_amount: teamMembers.reduce((sum, member) => sum + member.commit_amount, 0),
          team_best_case_amount: teamMembers.reduce((sum, member) => sum + member.best_case_amount, 0),
          team_pipeline_amount: teamMembers.reduce((sum, member) => sum + member.pipeline_amount, 0),
          team_quota_amount: teamMembers.reduce((sum, member) => sum + member.quota_amount, 0),
          team_member_count: teamMembers.length,
          team_quota_attainment: 0
        };
        
        if (teamMetrics.team_quota_amount > 0) {
          const teamProgress = teamMetrics.team_closed_amount + teamMetrics.team_commit_amount + teamMetrics.team_best_case_amount;
          teamMetrics.team_quota_attainment = (teamProgress / teamMetrics.team_quota_amount) * 100;
        }
        
        teamLead.team_metrics = teamMetrics;
        teamLead.display_mode = teamLead.has_personal_quota ? 'dual' : 'team_only';
      }

      teamData.push({
        team_id: team.id,
        team_name: team.team_name,
        team_description: team.description,
        team_lead_id: team.team_lead_id,
        default_role: team.default_role,
        default_sub_role: team.default_sub_role,
        members: processedMembers
      });
    }

    res.json({
      teams: teamData,
      period: period,
      date_range: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      }
    });

  } catch (error) {
    console.error('Team-based endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/teams-new/aggregated-target - Create team aggregated target
router.post('/aggregated-target', async (req, res) => {
  try {
    console.log('Team aggregated target creation request:', req.body);
    console.log('User making request:', { id: req.user.id, email: req.user.email });
    
    // Only managers can create team targets
    if (!req.user.is_manager && !req.user.is_admin) {
      console.log('Access denied for user:', req.user.email);
      return res.status(403).json({ error: 'Access denied - manager role required' });
    }

    const { manager_id, total_quota, avg_commission_rate, period_start, period_end, period_type } = req.body;

    // Validate required fields
    const missingFields = [];
    if (!manager_id) missingFields.push('manager_id');
    if (!total_quota) missingFields.push('total_quota');
    if (!avg_commission_rate) missingFields.push('avg_commission_rate');
    if (!period_start) missingFields.push('period_start');
    if (!period_end) missingFields.push('period_end');
    if (!period_type) missingFields.push('period_type');
    
    if (missingFields.length > 0) {
      console.log('Missing required fields:', missingFields);
      return res.status(400).json({ 
        error: 'Missing required fields', 
        missing_fields: missingFields 
      });
    }

    // Verify the manager exists and is in the same company
    const manager = await prisma.users.findUnique({
      where: { 
        id: manager_id,
        company_id: req.user.company_id
      }
    });

    if (!manager) {
      console.log('Manager not found:', { manager_id, company_id: req.user.company_id });
      return res.status(400).json({ 
        error: 'Manager not found or invalid'
      });
    }

    // Check if a team target already exists for this manager and period  
    const existingTarget = await prisma.targets.findFirst({
      where: {
        user_id: manager_id,
        is_active: true,
        period_start: new Date(period_start),
        period_end: new Date(period_end),
        team_target: true // Flag to indicate this is a team target
      }
    });

    if (existingTarget) {
      console.log('Existing team target found, updating:', existingTarget.id);
      
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
    const teamTarget = await prisma.targets.create({
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
        role: null
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

    console.log('Team target created successfully:', teamTarget.id);

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'team_target_created',
        entity_type: 'target',
        entity_id: teamTarget.id,
        context: {
          manager_id: manager_id,
          manager_email: manager.email,
          total_quota: Number(total_quota),
          avg_commission_rate: Number(avg_commission_rate),
          period_type: period_type
        },
        success: true
      }
    });

    res.json({
      success: true,
      message: 'Team target created successfully',
      target: teamTarget,
      action: 'created'
    });

  } catch (error) {
    console.error('Team aggregated target creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;