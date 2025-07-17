// routes/teams.js
import express from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Get team members
router.get('/', async (req, res) => {
  try {
    // Only admins and managers can view team
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Optimized query to avoid N+1 issues
    const teamMembers = await prisma.users.findMany({
      where: { company_id: req.user.company_id },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
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
    
    // Batch query for open deals
    const dealsData = await prisma.deals.groupBy({
      by: ['user_id'],
      where: {
        user_id: { in: teamMemberIds },
        status: 'open'
      },
      _sum: {
        amount: true
      },
      _count: {
        id: true
      }
    });

    // Batch query for active targets
    const targetsData = await prisma.targets.groupBy({
      by: ['user_id'],
      where: {
        user_id: { in: teamMemberIds },
        is_active: true
      },
      _sum: {
        quota_amount: true
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
    const dealsMap = new Map(dealsData.map(d => [d.user_id, d]));
    const targetsMap = new Map(targetsData.map(t => [t.user_id, t]));
    const commissionsMap = new Map(commissionsData.map(c => [c.user_id, c]));

    // Calculate performance metrics using batch data
    const teamWithMetrics = teamMembers.map(member => {
      const deals = dealsMap.get(member.id);
      const targets = targetsMap.get(member.id);
      const commissions = commissionsMap.get(member.id);
      
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
          open_deals_amount: deals?._sum?.amount ? Number(deals._sum.amount) : 0,
          current_quota: targets?._sum?.quota_amount ? Number(targets._sum.quota_amount) : 0,
          total_commissions: commissions?._sum?.commission_earned ? Number(commissions._sum.commission_earned) : 0,
          open_deals_count: deals?._count?.id || 0
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

// Update team member
router.patch('/:userId', async (req, res) => {
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

// Deactivate team member
router.delete('/:userId', async (req, res) => {
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

export default router;