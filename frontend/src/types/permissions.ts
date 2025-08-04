// Permission types for flag-based permission system

export interface UserPermissions {
  is_admin: boolean;
  is_manager: boolean;
}

export interface PermissionChecks {
  canManageTeam: boolean;      // View team data, create targets
  canEditTeamMembers: boolean;  // Invite, edit, remove team members
  canViewAllDeals: boolean;     // See all team deals
  canCreateTargets: boolean;    // Create/edit targets
  canApproveCommissions: boolean; // Approve commission payments
  canManageIntegrations: boolean; // Setup CRM integrations
}

/**
 * Get permission checks based on user flags
 */
export function getUserPermissions(user: UserPermissions | null): PermissionChecks {
  if (!user) {
    return {
      canManageTeam: false,
      canEditTeamMembers: false,
      canViewAllDeals: false,
      canCreateTargets: false,
      canApproveCommissions: false,
      canManageIntegrations: false,
    };
  }

  return {
    canManageTeam: user.is_admin || user.is_manager,
    canEditTeamMembers: user.is_admin,
    canViewAllDeals: user.is_admin || user.is_manager,
    canCreateTargets: user.is_admin || user.is_manager,
    canApproveCommissions: user.is_admin,
    canManageIntegrations: user.is_admin,
  };
}

/**
 * Get user permission level for display
 */
export function getUserPermissionLevel(user: UserPermissions | null): 'admin' | 'manager' | 'sales_rep' | null {
  if (!user) return null;
  if (user.is_admin) return 'admin';
  if (user.is_manager) return 'manager';
  return 'sales_rep';
}

/**
 * Get permission display text
 */
export function getPermissionDisplayText(user: UserPermissions | null): string {
  const level = getUserPermissionLevel(user);
  switch (level) {
    case 'admin':
      return 'Administrator';
    case 'manager':
      return 'Manager';
    case 'sales_rep':
      return 'Sales User';
    default:
      return 'Unknown';
  }
}