import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin } from '../middleware/secureAuth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/team-management/teams - Get all teams (admin only)
router.get('/teams', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { include_inactive } = req.query;
    
    const teams = await prisma.teams.findMany({
      where: {
        company_id: req.user.company_id,
        ...(include_inactive !== 'true' && { is_active: true })
      },
      include: {
        team_lead: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            is_admin: true
          }
        },
        team_members: {
          where: { is_active: true },
          include: {
            user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                role: true,
                sub_role: true,
                is_admin: true,
                is_active: true
              }
            }
          }
        },
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true
          }
        }
      },
      orderBy: [
        { is_active: 'desc' },
        { team_name: 'asc' }
      ]
    });

    // Calculate team stats
    const teamsWithStats = teams.map(team => ({
      ...team,
      member_count: team.team_members.length,
      active_members: team.team_members.filter(tm => tm.user.is_active).length,
      admin_members: team.team_members.filter(tm => tm.user.is_admin).length
    }));

    res.json({
      success: true,
      teams: teamsWithStats
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch teams',
      error: error.message 
    });
  }
});

// POST /api/team-management/teams - Create new team (admin only)
router.post('/teams', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { 
      team_name, 
      description, 
      team_lead_id, 
      default_role, 
      default_sub_role 
    } = req.body;

    // Validate required fields
    if (!team_name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Team name is required' 
      });
    }

    // Check if team already exists
    const existingTeam = await prisma.teams.findFirst({
      where: {
        company_id: req.user.company_id,
        team_name
      }
    });

    if (existingTeam) {
      return res.status(409).json({ 
        success: false, 
        message: 'Team with this name already exists' 
      });
    }

    // If team_lead_id is provided, ensure they have admin privileges
    if (team_lead_id) {
      await prisma.users.update({
        where: { id: team_lead_id },
        data: { is_admin: true }
      });
    }

    // Create team
    const newTeam = await prisma.teams.create({
      data: {
        team_name,
        description: description || null,
        team_lead_id: team_lead_id || null,
        default_role: default_role || null,
        default_sub_role: default_sub_role || null,
        company_id: req.user.company_id,
        created_by_admin_id: req.user.id
      },
      include: {
        team_lead: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      team: newTeam,
      message: 'Team created successfully'
    });
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create team',
      error: error.message 
    });
  }
});

// PUT /api/team-management/teams/:id - Update team (admin only)
router.put('/teams/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      team_name, 
      description, 
      team_lead_id, 
      default_role, 
      default_sub_role,
      is_active 
    } = req.body;

    // If changing team lead, ensure new lead has admin privileges
    if (team_lead_id) {
      await prisma.users.update({
        where: { id: team_lead_id },
        data: { is_admin: true }
      });
    }

    const updatedTeam = await prisma.teams.update({
      where: { 
        id,
        company_id: req.user.company_id // Ensure team belongs to same company
      },
      data: {
        ...(team_name && { team_name }),
        ...(description !== undefined && { description }),
        ...(team_lead_id !== undefined && { team_lead_id }),
        ...(default_role !== undefined && { default_role }),
        ...(default_sub_role !== undefined && { default_sub_role }),
        ...(is_active !== undefined && { is_active })
      },
      include: {
        team_lead: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        },
        team_members: {
          where: { is_active: true },
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
        }
      }
    });

    res.json({
      success: true,
      team: updatedTeam,
      message: 'Team updated successfully'
    });
  } catch (error) {
    console.error('Error updating team:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        success: false, 
        message: 'Team not found' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update team',
      error: error.message 
    });
  }
});

// DELETE /api/team-management/teams/:id - Deactivate team (admin only)
router.delete('/teams/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Deactivate team instead of deleting (soft delete)
    const deactivatedTeam = await prisma.teams.update({
      where: { 
        id,
        company_id: req.user.company_id
      },
      data: {
        is_active: false
      }
    });

    // Also deactivate all team memberships
    await prisma.team_members.updateMany({
      where: { team_id: id },
      data: { is_active: false }
    });

    res.json({
      success: true,
      team: deactivatedTeam,
      message: 'Team deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating team:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        success: false, 
        message: 'Team not found' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Failed to deactivate team',
      error: error.message 
    });
  }
});

// POST /api/team-management/teams/:id/members - Add user to team (admin only)
router.post('/teams/:id/members', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id: teamId } = req.params;
    const { user_id, role_override, sub_role_override } = req.body;

    if (!user_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    // Check if user is already in this team
    const existingMembership = await prisma.team_members.findFirst({
      where: {
        team_id: teamId,
        user_id,
        is_active: true
      }
    });

    if (existingMembership) {
      return res.status(409).json({ 
        success: false, 
        message: 'User is already a member of this team' 
      });
    }

    // Add user to team
    const membership = await prisma.team_members.create({
      data: {
        team_id: teamId,
        user_id,
        role_override: role_override || null,
        sub_role_override: sub_role_override || null,
        added_by_admin_id: req.user.id
      },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            role: true,
            sub_role: true
          }
        },
        team: {
          select: {
            id: true,
            team_name: true,
            default_role: true,
            default_sub_role: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      membership,
      message: 'User added to team successfully'
    });
  } catch (error) {
    console.error('Error adding user to team:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add user to team',
      error: error.message 
    });
  }
});

// PUT /api/team-management/teams/:teamId/members/:memberId - Update team member (admin only)
router.put('/teams/:teamId/members/:memberId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { teamId, memberId } = req.params;
    const { role_override, sub_role_override, is_active } = req.body;

    const updatedMembership = await prisma.team_members.update({
      where: { 
        id: memberId,
        team_id: teamId // Ensure membership belongs to this team
      },
      data: {
        ...(role_override !== undefined && { role_override }),
        ...(sub_role_override !== undefined && { sub_role_override }),
        ...(is_active !== undefined && { is_active })
      },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            role: true,
            sub_role: true
          }
        }
      }
    });

    res.json({
      success: true,
      membership: updatedMembership,
      message: 'Team membership updated successfully'
    });
  } catch (error) {
    console.error('Error updating team membership:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        success: false, 
        message: 'Team membership not found' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update team membership',
      error: error.message 
    });
  }
});

// DELETE /api/team-management/teams/:teamId/members/:memberId - Remove user from team (admin only)
router.delete('/teams/:teamId/members/:memberId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { teamId, memberId } = req.params;

    // Deactivate membership instead of deleting
    const deactivatedMembership = await prisma.team_members.update({
      where: { 
        id: memberId,
        team_id: teamId
      },
      data: {
        is_active: false
      }
    });

    res.json({
      success: true,
      membership: deactivatedMembership,
      message: 'User removed from team successfully'
    });
  } catch (error) {
    console.error('Error removing user from team:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        success: false, 
        message: 'Team membership not found' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove user from team',
      error: error.message 
    });
  }
});

// GET /api/team-management/teams/:id/members - Get team members (admin only)
router.get('/teams/:id/members', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { include_inactive } = req.query;

    const members = await prisma.team_members.findMany({
      where: {
        team_id: id,
        ...(include_inactive !== 'true' && { is_active: true })
      },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            role: true,
            sub_role: true,
            is_admin: true,
            is_active: true
          }
        },
        team: {
          select: {
            id: true,
            team_name: true,
            default_role: true,
            default_sub_role: true
          }
        }
      },
      orderBy: {
        joined_date: 'asc'
      }
    });

    // Calculate effective roles for each member
    const membersWithEffectiveRoles = members.map(member => ({
      ...member,
      effective_role: member.role_override || member.team.default_role || member.user.role,
      effective_sub_role: member.sub_role_override || member.team.default_sub_role || member.user.sub_role
    }));

    res.json({
      success: true,
      members: membersWithEffectiveRoles
    });
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch team members',
      error: error.message 
    });
  }
});

export default router;