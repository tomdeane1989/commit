// routes/team-management.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireTeamManagement, requireTeamView, attachPermissions } from '../middleware/permissions.js';

const router = express.Router();
const prisma = new PrismaClient();

// Attach permissions to all routes
router.use(attachPermissions);

// Get all teams in the company
router.get('/', requireTeamView, async (req, res) => {
  try {
    const teams = await prisma.teams.findMany({
      where: {
        company_id: req.user.company_id,
        is_active: true
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
          where: {
            is_active: true
          },
          include: {
            user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                role: true
              }
            }
          }
        },
        _count: {
          select: {
            team_members: {
              where: {
                is_active: true
              }
            }
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    res.json({
      teams,
      success: true
    });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific team
router.get('/:teamId', requireTeamView, async (req, res) => {
  try {
    const { teamId } = req.params;

    const team = await prisma.teams.findFirst({
      where: {
        id: teamId,
        company_id: req.user.company_id
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
          where: {
            is_active: true
          },
          include: {
            user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                role: true,
                territory: true
              }
            }
          }
        }
      }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Get team performance metrics
    const teamMemberIds = team.team_members.map(tm => tm.user_id);
    
    // Add team lead to the list if they're not already a member
    if (team.team_lead_id && !teamMemberIds.includes(team.team_lead_id)) {
      teamMemberIds.push(team.team_lead_id);
    }

    // Get current period dates
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const quarterStartMonth = currentQuarter * 3;
    
    const periodStart = new Date(currentYear, quarterStartMonth, 1);
    const periodEnd = new Date(currentYear, quarterStartMonth + 3, 0, 23, 59, 59, 999);

    // Get team performance data
    const [closedDeals, openDeals, targets] = await Promise.all([
      // Closed deals
      prisma.deals.aggregate({
        where: {
          user_id: { in: teamMemberIds },
          status: 'closed_won',
          closed_date: {
            gte: periodStart,
            lte: periodEnd
          }
        },
        _sum: {
          amount: true
        },
        _count: {
          id: true
        }
      }),
      // Open deals
      prisma.deals.aggregate({
        where: {
          user_id: { in: teamMemberIds },
          status: 'open',
          close_date: {
            gte: periodStart,
            lte: periodEnd
          }
        },
        _sum: {
          amount: true
        },
        _count: {
          id: true
        }
      }),
      // Active targets
      prisma.targets.findMany({
        where: {
          user_id: { in: teamMemberIds },
          is_active: true,
          period_start: { lte: periodEnd },
          period_end: { gte: periodStart }
        },
        select: {
          quota_amount: true,
          commission_rate: true
        }
      })
    ]);

    const totalQuota = targets.reduce((sum, t) => sum + Number(t.quota_amount), 0);
    const avgCommissionRate = targets.length > 0 
      ? targets.reduce((sum, t) => sum + Number(t.commission_rate), 0) / targets.length 
      : 0;

    res.json({
      team: {
        ...team,
        performance: {
          period_start: periodStart,
          period_end: periodEnd,
          closed_amount: Number(closedDeals._sum.amount || 0),
          closed_count: closedDeals._count.id,
          open_amount: Number(openDeals._sum.amount || 0),
          open_count: openDeals._count.id,
          total_quota: totalQuota,
          avg_commission_rate: avgCommissionRate,
          member_count: teamMemberIds.length
        }
      },
      success: true
    });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new team
router.post('/', requireTeamManagement, async (req, res) => {
  try {
    const { team_name, description, team_lead_id, default_role, default_sub_role } = req.body;

    // Validate required fields
    if (!team_name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    // Check if team name already exists in company
    const existingTeam = await prisma.teams.findFirst({
      where: {
        company_id: req.user.company_id,
        team_name: team_name
      }
    });

    if (existingTeam) {
      return res.status(400).json({ error: 'A team with this name already exists' });
    }

    // Validate team lead if provided
    if (team_lead_id) {
      const teamLead = await prisma.users.findFirst({
        where: {
          id: team_lead_id,
          company_id: req.user.company_id,
          role: 'manager'
        }
      });

      if (!teamLead) {
        return res.status(400).json({ error: 'Invalid team lead. Must be a manager in the company.' });
      }
    }

    // Create the team
    const newTeam = await prisma.teams.create({
      data: {
        team_name,
        description,
        team_lead_id,
        default_role,
        default_sub_role,
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

    // Log the creation
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'team_created',
        entity_type: 'team',
        entity_id: newTeam.id,
        context: {
          team_name: team_name,
          team_lead_id: team_lead_id,
          created_by: req.user.email
        },
        success: true
      }
    });

    res.status(201).json({
      team: newTeam,
      success: true,
      message: 'Team created successfully'
    });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a team
router.put('/:teamId', requireTeamManagement, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { team_name, description, team_lead_id, default_role, default_sub_role, is_active } = req.body;

    // Check if team exists and belongs to company
    const existingTeam = await prisma.teams.findFirst({
      where: {
        id: teamId,
        company_id: req.user.company_id
      }
    });

    if (!existingTeam) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // If renaming, check for duplicate names
    if (team_name && team_name !== existingTeam.team_name) {
      const duplicateTeam = await prisma.teams.findFirst({
        where: {
          company_id: req.user.company_id,
          team_name: team_name,
          NOT: {
            id: teamId
          }
        }
      });

      if (duplicateTeam) {
        return res.status(400).json({ error: 'A team with this name already exists' });
      }
    }

    // Validate new team lead if provided
    if (team_lead_id) {
      const teamLead = await prisma.users.findFirst({
        where: {
          id: team_lead_id,
          company_id: req.user.company_id,
          role: 'manager'
        }
      });

      if (!teamLead) {
        return res.status(400).json({ error: 'Invalid team lead. Must be a manager in the company.' });
      }
    }

    // Update the team
    const updatedTeam = await prisma.teams.update({
      where: { id: teamId },
      data: {
        team_name,
        description,
        team_lead_id,
        default_role,
        default_sub_role,
        is_active
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

    // Log the update
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'team_updated',
        entity_type: 'team',
        entity_id: teamId,
        context: {
          updated_fields: { team_name, description, team_lead_id, is_active },
          updated_by: req.user.email
        },
        success: true
      }
    });

    res.json({
      team: updatedTeam,
      success: true,
      message: 'Team updated successfully'
    });
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add members to a team
router.post('/:teamId/members', requireTeamManagement, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { user_ids, role_override, sub_role_override } = req.body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ error: 'User IDs array is required' });
    }

    // Check if team exists and belongs to company
    const team = await prisma.teams.findFirst({
      where: {
        id: teamId,
        company_id: req.user.company_id,
        is_active: true
      }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Validate all users exist and belong to company
    const users = await prisma.users.findMany({
      where: {
        id: { in: user_ids },
        company_id: req.user.company_id,
        is_active: true
      }
    });

    if (users.length !== user_ids.length) {
      return res.status(400).json({ error: 'One or more users not found or inactive' });
    }

    // Check for existing memberships
    const existingMemberships = await prisma.team_members.findMany({
      where: {
        team_id: teamId,
        user_id: { in: user_ids },
        is_active: true
      }
    });

    const existingUserIds = existingMemberships.map(m => m.user_id);
    const newUserIds = user_ids.filter(id => !existingUserIds.includes(id));

    if (newUserIds.length === 0) {
      return res.status(400).json({ error: 'All users are already members of this team' });
    }

    // Add new members
    const newMemberships = await prisma.team_members.createMany({
      data: newUserIds.map(userId => ({
        team_id: teamId,
        user_id: userId,
        role_override,
        sub_role_override,
        added_by_admin_id: req.user.id
      }))
    });

    // Log the additions
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'team_members_added',
        entity_type: 'team',
        entity_id: teamId,
        context: {
          team_name: team.team_name,
          added_user_ids: newUserIds,
          added_count: newUserIds.length,
          added_by: req.user.email
        },
        success: true
      }
    });

    res.status(201).json({
      added_count: newUserIds.length,
      already_members: existingUserIds.length,
      success: true,
      message: `Successfully added ${newUserIds.length} members to the team`
    });
  } catch (error) {
    console.error('Add team members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove member from team
router.delete('/:teamId/members/:userId', requireTeamManagement, async (req, res) => {
  try {
    const { teamId, userId } = req.params;

    // Check if membership exists
    const membership = await prisma.team_members.findFirst({
      where: {
        team_id: teamId,
        user_id: userId,
        is_active: true
      },
      include: {
        team: {
          select: {
            team_name: true,
            company_id: true
          }
        },
        user: {
          select: {
            email: true
          }
        }
      }
    });

    if (!membership) {
      return res.status(404).json({ error: 'Team membership not found' });
    }

    // Verify company access
    if (membership.team.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Deactivate membership
    await prisma.team_members.update({
      where: { id: membership.id },
      data: { is_active: false }
    });

    // Log the removal
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'team_member_removed',
        entity_type: 'team',
        entity_id: teamId,
        context: {
          team_name: membership.team.team_name,
          removed_user_email: membership.user.email,
          removed_by: req.user.email
        },
        success: true
      }
    });

    res.json({
      success: true,
      message: 'Team member removed successfully'
    });
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete (deactivate) a team
router.delete('/:teamId', requireTeamManagement, async (req, res) => {
  try {
    const { teamId } = req.params;

    // Check if team exists and belongs to company
    const team = await prisma.teams.findFirst({
      where: {
        id: teamId,
        company_id: req.user.company_id
      },
      include: {
        _count: {
          select: {
            team_members: {
              where: {
                is_active: true
              }
            }
          }
        }
      }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Deactivate the team and all active memberships
    await prisma.$transaction([
      // Deactivate team
      prisma.teams.update({
        where: { id: teamId },
        data: { is_active: false }
      }),
      // Deactivate all memberships
      prisma.team_members.updateMany({
        where: {
          team_id: teamId,
          is_active: true
        },
        data: { is_active: false }
      })
    ]);

    // Log the deletion
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'team_deleted',
        entity_type: 'team',
        entity_id: teamId,
        context: {
          team_name: team.team_name,
          active_members_count: team._count.team_members,
          deleted_by: req.user.email
        },
        success: true
      }
    });

    res.json({
      success: true,
      message: 'Team deactivated successfully'
    });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;