// Centralized permission middleware
// Provides consistent permission checking across all routes

import { 
  isAdmin, 
  isManager, 
  canManageTeam, 
  canPerformAdminActions,
  isSalesUser,
  getUserPermissionLevel 
} from './roleHelpers.js';

/**
 * Middleware to require admin permissions
 * Use for routes that only admins should access
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED' 
    });
  }

  if (!isAdmin(req.user)) {
    return res.status(403).json({ 
      error: 'Administrator access required',
      code: 'ADMIN_REQUIRED',
      userLevel: getUserPermissionLevel(req.user)
    });
  }

  next();
};

/**
 * Middleware to require manager permissions (includes admins)
 * Use for routes that managers and admins can access
 */
export const requireManager = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED' 
    });
  }

  if (!canManageTeam(req.user)) {
    return res.status(403).json({ 
      error: 'Manager access required',
      code: 'MANAGER_REQUIRED',
      userLevel: getUserPermissionLevel(req.user)
    });
  }

  next();
};

/**
 * Middleware to check if user can access a specific resource
 * Allows access if user owns the resource OR has manager permissions
 */
export const requireOwnerOrManager = (userIdField = 'user_id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED' 
      });
    }

    // Get the resource owner ID from params or body
    const resourceOwnerId = req.params[userIdField] || 
                           req.body[userIdField] || 
                           req.query[userIdField];

    // Allow if user is the owner or has manager permissions
    if (req.user.id === resourceOwnerId || canManageTeam(req.user)) {
      next();
    } else {
      return res.status(403).json({ 
        error: 'Access denied - you can only access your own resources',
        code: 'ACCESS_DENIED',
        userLevel: getUserPermissionLevel(req.user)
      });
    }
  };
};

/**
 * Middleware to check if user can modify team members
 * Only admins can invite, edit, or remove team members
 */
export const requireTeamManagement = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED' 
    });
  }

  if (!canPerformAdminActions(req.user)) {
    return res.status(403).json({ 
      error: 'Only administrators can manage team members',
      code: 'TEAM_MANAGEMENT_REQUIRED',
      userLevel: getUserPermissionLevel(req.user)
    });
  }

  next();
};

/**
 * Middleware to check if user can view team data
 * Managers and admins can view team data
 */
export const requireTeamView = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED' 
    });
  }

  if (!canManageTeam(req.user)) {
    return res.status(403).json({ 
      error: 'Team view access required',
      code: 'TEAM_VIEW_REQUIRED',
      userLevel: getUserPermissionLevel(req.user)
    });
  }

  next();
};

/**
 * Middleware to check if user can create/edit targets
 * Managers and admins can manage targets
 */
export const requireTargetManagement = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED' 
    });
  }

  if (!canManageTeam(req.user)) {
    return res.status(403).json({ 
      error: 'Target management access required',
      code: 'TARGET_MANAGEMENT_REQUIRED',
      userLevel: getUserPermissionLevel(req.user)
    });
  }

  next();
};

/**
 * Middleware to check if user can approve commissions
 * Only admins can approve commission payments
 */
export const requireCommissionApproval = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED' 
    });
  }

  if (!isAdmin(req.user)) {
    return res.status(403).json({ 
      error: 'Only administrators can approve commissions',
      code: 'COMMISSION_APPROVAL_REQUIRED',
      userLevel: getUserPermissionLevel(req.user)
    });
  }

  next();
};

/**
 * Middleware to check if user can manage integrations
 * Only admins can setup/modify CRM integrations
 */
export const requireIntegrationManagement = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED' 
    });
  }

  if (!isAdmin(req.user)) {
    return res.status(403).json({ 
      error: 'Only administrators can manage integrations',
      code: 'INTEGRATION_MANAGEMENT_REQUIRED',
      userLevel: getUserPermissionLevel(req.user)
    });
  }

  next();
};

/**
 * Dynamic permission middleware
 * Allows checking multiple permission levels
 * @param {Array<string>} allowedLevels - Array of allowed permission levels ['admin', 'manager', 'sales_user']
 */
export const requirePermissionLevel = (allowedLevels) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED' 
      });
    }

    const userLevel = getUserPermissionLevel(req.user);
    
    if (allowedLevels.includes(userLevel)) {
      next();
    } else {
      return res.status(403).json({ 
        error: `Access denied - requires one of: ${allowedLevels.join(', ')}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        userLevel: userLevel,
        required: allowedLevels
      });
    }
  };
};

/**
 * Middleware to check if user can access a specific team
 * Allows access if user is admin, team lead, or team member
 */
export const requireTeamAccess = (teamIdParam = 'teamId') => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED' 
      });
    }

    const teamId = req.params[teamIdParam];
    if (!teamId) {
      return res.status(400).json({ 
        error: 'Team ID required',
        code: 'TEAM_ID_REQUIRED' 
      });
    }

    // Import PrismaClient here to avoid circular dependencies
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
      // Check if user has access to this specific team
      const { canAccessTeam } = await import('./roleHelpers.js');
      const hasAccess = await canAccessTeam(req.user, teamId, prisma);

      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Access denied - you do not have access to this team',
          code: 'TEAM_ACCESS_DENIED',
          userLevel: getUserPermissionLevel(req.user)
        });
      }

      next();
    } finally {
      await prisma.$disconnect();
    }
  };
};

/**
 * Middleware to add permission info to request
 * Useful for logging and conditional logic in routes
 */
export const attachPermissions = (req, res, next) => {
  if (req.user) {
    req.permissions = {
      level: getUserPermissionLevel(req.user),
      isAdmin: isAdmin(req.user),
      isManager: isManager(req.user),
      isSalesUser: isSalesUser(req.user),
      canManageTeam: canManageTeam(req.user),
      canEditTeamMembers: canPerformAdminActions(req.user)
    };
  } else {
    req.permissions = {
      level: null,
      isAdmin: false,
      isManager: false,
      isSalesUser: false,
      canManageTeam: false,
      canEditTeamMembers: false
    };
  }
  
  next();
};

// Export all middleware functions
export default {
  requireAdmin,
  requireManager,
  requireOwnerOrManager,
  requireTeamManagement,
  requireTeamView,
  requireTeamAccess,
  requireTargetManagement,
  requireCommissionApproval,
  requireIntegrationManagement,
  requirePermissionLevel,
  attachPermissions
};