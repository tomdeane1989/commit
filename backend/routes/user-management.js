import express from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin } from '../middleware/secureAuth.js';
import { canManageTeam } from '../middleware/roleHelpers.js';

const router = express.Router();
const prisma = new PrismaClient();

// Helper function to get effective user role (individual > team > direct)
const getEffectiveRole = async (userId) => {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    include: {
      team_memberships: {
        where: { is_active: true },
        include: {
          team: {
            include: {
              team_lead: {
                select: { id: true, first_name: true, last_name: true }
              }
            }
          }
        }
      },
      reports_to: {
        select: { id: true, first_name: true, last_name: true, is_admin: true }
      }
    }
  });

  if (!user) return null;

  const teamMembership = user.team_memberships[0]; // Assuming one active team per user
  
  return {
    ...user,
    effective_role: teamMembership?.role_override || teamMembership?.team?.default_role || user.role,
    effective_sub_role: teamMembership?.sub_role_override || teamMembership?.team?.default_sub_role || user.sub_role,
    team: teamMembership?.team || null
  };
};

// GET /api/user-management/users - Get all users (admin only)
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { include_inactive } = req.query;
    
    const users = await prisma.users.findMany({
      where: {
        company_id: req.user.company_id,
        ...(include_inactive !== 'true' && { is_active: true })
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        sub_role: true,
        is_admin: true,
        is_active: true,
        hire_date: true,
        reports_to_id: true,
        created_at: true,
        reports_to: {
          select: {
            id: true,
            first_name: true,
            last_name: true
          }
        },
        team_memberships: {
          where: { is_active: true },
          include: {
            team: {
              select: {
                id: true,
                team_name: true,
                default_role: true,
                default_sub_role: true,
                team_lead: {
                  select: {
                    id: true,
                    first_name: true,
                    last_name: true
                  }
                }
              }
            }
          }
        },
        direct_reports: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            role: true
          }
        }
      },
      orderBy: [
        { is_admin: 'desc' },
        { last_name: 'asc' }
      ]
    });

    // Calculate effective roles for each user
    const usersWithEffectiveRoles = users.map(user => {
      const teamMembership = user.team_memberships[0];
      return {
        ...user,
        effective_role: teamMembership?.role_override || teamMembership?.team?.default_role || user.role,
        effective_sub_role: teamMembership?.sub_role_override || teamMembership?.team?.default_sub_role || user.sub_role,
        team: teamMembership?.team || null
      };
    });

    res.json({
      success: true,
      users: usersWithEffectiveRoles
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch users',
      error: error.message 
    });
  }
});

// POST /api/user-management/users - Create new user (admin only)
router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { 
      email, 
      first_name, 
      last_name, 
      role, 
      sub_role, 
      reports_to_id, 
      is_admin,
      password,
      team_id 
    } = req.body;

    // Validate required fields
    if (!email || !first_name || !last_name || !role || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: email, first_name, last_name, role, password' 
      });
    }

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: 'User with this email already exists' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const newUser = await prisma.users.create({
      data: {
        email,
        first_name,
        last_name,
        role,
        sub_role: sub_role || null,
        reports_to_id: reports_to_id || null,
        is_admin: is_admin || false,
        password: hashedPassword,
        company_id: req.user.company_id
      }
    });

    // Add to team if specified
    if (team_id) {
      await prisma.team_members.create({
        data: {
          team_id,
          user_id: newUser.id,
          added_by_admin_id: req.user.id
        }
      });
    }

    // Return user without password
    const { password: _, ...userResponse } = newUser;
    
    res.status(201).json({
      success: true,
      user: userResponse,
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create user',
      error: error.message 
    });
  }
});

// PUT /api/user-management/users/:id - Update user (admin only)
router.put('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      first_name, 
      last_name, 
      role, 
      sub_role, 
      reports_to_id, 
      is_admin,
      is_active 
    } = req.body;

    // Don't allow users to modify themselves unless they're updating non-critical fields
    if (id === req.user.id && (is_admin !== undefined || is_active === false)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Cannot modify your own admin status or deactivate yourself' 
      });
    }

    const updatedUser = await prisma.users.update({
      where: { 
        id,
        company_id: req.user.company_id // Ensure user belongs to same company
      },
      data: {
        ...(first_name && { first_name }),
        ...(last_name && { last_name }),
        ...(role && { role }),
        ...(sub_role !== undefined && { sub_role }),
        ...(reports_to_id !== undefined && { reports_to_id }),
        ...(is_admin !== undefined && { is_admin }),
        ...(is_active !== undefined && { is_active })
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        sub_role: true,
        is_admin: true,
        is_active: true,
        reports_to_id: true,
        updated_at: true
      }
    });

    res.json({
      success: true,
      user: updatedUser,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Error updating user:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update user',
      error: error.message 
    });
  }
});

// DELETE /api/user-management/users/:id - Deactivate user (admin only)
router.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Don't allow users to deactivate themselves
    if (id === req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Cannot deactivate yourself' 
      });
    }

    // Deactivate user instead of deleting (soft delete)
    const deactivatedUser = await prisma.users.update({
      where: { 
        id,
        company_id: req.user.company_id
      },
      data: {
        is_active: false
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        is_active: true
      }
    });

    // Also deactivate team memberships
    await prisma.team_members.updateMany({
      where: { user_id: id },
      data: { is_active: false }
    });

    res.json({
      success: true,
      user: deactivatedUser,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating user:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Failed to deactivate user',
      error: error.message 
    });
  }
});

// GET /api/user-management/roles - Get company roles (managers and admins can read)
router.get('/roles', requireAuth, async (req, res) => {
  try {
    console.log('🎭 ROLES ENDPOINT CALLED');
    console.log('User:', {
      email: req.user.email,
      is_admin: req.user.is_admin,
      is_manager: req.user.is_manager,
      can_view_all_teams: req.user.can_view_all_teams,
      company_id: req.user.company_id
    });
    console.log('canManageTeam result:', canManageTeam(req.user));
    
    // Allow managers and admins to read roles for inviting team members
    if (!canManageTeam(req.user)) {
      console.log('❌ ACCESS DENIED - canManageTeam returned false');
      return res.status(403).json({ error: 'Access denied - requires manager or admin privileges' });
    }
    
    console.log('✅ Permission check passed, fetching roles for company:', req.user.company_id);
    const roles = await prisma.company_roles.findMany({
      where: { company_id: req.user.company_id },
      orderBy: [
        { is_default: 'desc' },
        { role_name: 'asc' }
      ]
    });

    console.log('📋 Found roles:', roles.length, 'roles');
    console.log('Role names:', roles.map(r => r.role_name));
    
    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch roles',
      error: error.message 
    });
  }
});

// POST /api/user-management/roles - Create company role (admin only)
router.post('/roles', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { role_name, description } = req.body;

    if (!role_name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Role name is required' 
      });
    }

    const newRole = await prisma.company_roles.create({
      data: {
        role_name,
        description: description || null,
        company_id: req.user.company_id,
        created_by_admin_id: req.user.id
      }
    });

    res.status(201).json({
      success: true,
      role: newRole,
      message: 'Role created successfully'
    });
  } catch (error) {
    console.error('Error creating role:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        success: false, 
        message: 'Role with this name already exists' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create role',
      error: error.message 
    });
  }
});

// GET /api/user-management/sub-roles - Get company sub-roles (admin only)
router.get('/sub-roles', requireAuth, requireAdmin, async (req, res) => {
  try {
    const subRoles = await prisma.company_sub_roles.findMany({
      where: { company_id: req.user.company_id },
      orderBy: [
        { is_default: 'desc' },
        { sub_role_name: 'asc' }
      ]
    });

    res.json({
      success: true,
      sub_roles: subRoles
    });
  } catch (error) {
    console.error('Error fetching sub-roles:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch sub-roles',
      error: error.message 
    });
  }
});

// POST /api/user-management/sub-roles - Create company sub-role (admin only)
router.post('/sub-roles', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { sub_role_name, description } = req.body;

    if (!sub_role_name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Sub-role name is required' 
      });
    }

    const newSubRole = await prisma.company_sub_roles.create({
      data: {
        sub_role_name,
        description: description || null,
        company_id: req.user.company_id,
        created_by_admin_id: req.user.id
      }
    });

    res.status(201).json({
      success: true,
      sub_role: newSubRole,
      message: 'Sub-role created successfully'
    });
  } catch (error) {
    console.error('Error creating sub-role:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        success: false, 
        message: 'Sub-role with this name already exists' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create sub-role',
      error: error.message 
    });
  }
});

export default router;