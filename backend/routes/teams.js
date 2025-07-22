// routes/teams.js
import express from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { isAdmin, isManager, canManageTeam } from '../middleware/roleHelpers.js';

const router = express.Router();
const prisma = new PrismaClient();

// Get team members
router.get('/', async (req, res) => {
  try {
    // Only managers (including admins) can view team
    if (!canManageTeam(req.user)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

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
        is_active: true,
        hire_date: true,
        territory: true,
        created_at: true,
        manager: {
          select: { first_name: true, last_name: true, email: true }
        },
        _count: {
          select: { reports: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // Get aggregated data for all team members in batch queries
    const teamMemberIds = teamMembers.map(member => member.id);
    
    // Batch query for open deals - filter by expected close date within the period
    const openDealsData = await prisma.deals.groupBy({
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
    const closedWonDealsData = await prisma.deals.groupBy({
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
    // Filter targets that overlap with the selected period
    const targetsData = await prisma.targets.findMany({
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
        period_end: true
      }
    });

    // Batch query for commit deals (categorized as commit by reps)
    const commitDealsData = await prisma.deals.findMany({
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
    const bestCaseDealsData = await prisma.deals.findMany({
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
    const commissionsData = await prisma.commissions.groupBy({
      by: ['user_id'],
      where: {
        user_id: { in: teamMemberIds }
      },
      _sum: {
        commission_earned: true
      }
    });

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
      const target = targetsMap.get(member.id);
      const commissions = commissionsMap.get(member.id);
      
      const openDealsAmount = openDeals?._sum?.amount ? Number(openDeals._sum.amount) : 0;
      const closedWonAmount = closedWonDeals?._sum?.amount ? Number(closedWonDeals._sum.amount) : 0;
      const commitAmount = commitDeals?.amount || 0;
      const bestCaseAmount = bestCaseDeals?.amount || 0;
      
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
      
      // Calculate pro-rated quota for the selected period
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
          // Calculate pro-rated quota based on period type (simple division)
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
        is_active: member.is_active,
        hire_date: member.hire_date,
        territory: member.territory,
        created_at: member.created_at,
        manager: member.manager,
        reports_count: member._count.reports,
        performance: {
          open_deals_amount: pipelineAmount, // All open pipeline deals (for reference)
          closed_won_amount: closedWonAmount,
          commit_amount: commitAmount,
          best_case_amount: bestCaseAmount,
          quota_progress_amount: quotaProgressAmount, // closed + commit + best case
          current_quota: currentQuota,
          total_commissions: calculatedCommissions || (commissions?._sum?.commission_earned ? Number(commissions._sum.commission_earned) : 0),
          open_deals_count: openDeals?._count?.id || 0,
          closed_won_count: closedWonDeals?._count?.id || 0,
          commit_count: commitDeals?.count || 0,
          best_case_count: bestCaseDeals?.count || 0,
          quota_attainment: currentQuota > 0 ? (quotaProgressAmount / currentQuota) * 100 : 0,
          target_period: displayPeriod
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

// Invite team member
router.post('/invite', async (req, res) => {
  try {
    // Only admins can invite team members
    if (!isAdmin(req.user)) {
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
        territory: territory || null,
        manager_id: manager_id || null,
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

// Update team member
router.patch('/:userId', async (req, res) => {
  try {
    // Only admins can edit team members
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: 'Only admins can edit team members' });
    }

    const { userId } = req.params;
    const { first_name, last_name, role, territory, manager_id, is_active, is_admin } = req.body;

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
        is_active,
        is_admin
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

// Deactivate team member
router.delete('/:userId', async (req, res) => {
  try {
    // Only admins can delete team members
    if (!isAdmin(req.user)) {
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

export default router;