// Role and permission helper functions
// Using flag-based permissions (is_admin, is_manager) instead of string roles

/**
 * Check if user has admin permissions
 * Admin users can perform all actions including user management
 * @param {Object} user - The user object from req.user
 * @returns {boolean} - True if user has admin permissions
 */
export const isAdmin = (user) => {
  return user && user.is_admin === true;
};

/**
 * Check if user has manager permissions
 * Managers can view team data and manage targets
 * @param {Object} user - The user object from req.user
 * @returns {boolean} - True if user is a manager (but not necessarily admin)
 */
export const isManager = (user) => {
  return user && user.is_manager === true;
};

/**
 * Check if user can manage team (managers and admins)
 * This includes viewing team data, creating targets, etc.
 * @param {Object} user - The user object from req.user
 * @returns {boolean} - True if user can manage team
 */
export const canManageTeam = (user) => {
  return user && (user.is_admin === true || user.is_manager === true);
};

/**
 * Check if user can perform admin-only actions
 * Such as inviting users, editing team members, etc.
 * @param {Object} user - The user object from req.user
 * @returns {boolean} - True if user has admin permissions
 */
export const canPerformAdminActions = (user) => {
  return isAdmin(user);
};

/**
 * Check if user is a regular sales user (no special permissions)
 * @param {Object} user - The user object from req.user
 * @returns {boolean} - True if user has no admin or manager permissions
 */
export const isSalesUser = (user) => {
  return user && !user.is_admin && !user.is_manager;
};

// Alias for backwards compatibility
export const isSalesRep = isSalesUser;

/**
 * Get user permission level for display/logic purposes
 * @param {Object} user - The user object from req.user
 * @returns {string} - 'admin', 'manager', or 'sales_rep'
 */
export const getUserPermissionLevel = (user) => {
  if (!user) return null;
  if (user.is_admin) return 'admin';
  if (user.is_manager) return 'manager';
  return 'sales_rep';
};

/**
 * Check if user is a team lead
 * Team leads can view their team's data
 * @param {Object} user - The user object from req.user
 * @param {string} teamId - The team ID to check against
 * @returns {Promise<boolean>} - True if user is the team lead
 */
export const isTeamLead = async (user, teamId, prisma) => {
  if (!user || !teamId) return false;
  
  const team = await prisma.teams.findFirst({
    where: {
      id: teamId,
      team_lead_id: user.id,
      is_active: true
    }
  });
  
  return !!team;
};

/**
 * Check if user is a member of a specific team
 * @param {Object} user - The user object from req.user
 * @param {string} teamId - The team ID to check against
 * @returns {Promise<boolean>} - True if user is an active team member
 */
export const isTeamMember = async (user, teamId, prisma) => {
  if (!user || !teamId) return false;
  
  const membership = await prisma.team_members.findFirst({
    where: {
      team_id: teamId,
      user_id: user.id,
      is_active: true
    }
  });
  
  return !!membership;
};

/**
 * Get all teams a user belongs to
 * @param {Object} user - The user object from req.user
 * @returns {Promise<Array>} - Array of team IDs the user belongs to
 */
export const getUserTeams = async (user, prisma) => {
  if (!user) return [];
  
  const memberships = await prisma.team_members.findMany({
    where: {
      user_id: user.id,
      is_active: true
    },
    include: {
      team: {
        select: {
          id: true,
          team_name: true
        }
      }
    }
  });
  
  return memberships.map(m => m.team);
};

/**
 * Check if user can access team data
 * True if user is admin, team lead, or team member
 * @param {Object} user - The user object from req.user
 * @param {string} teamId - The team ID to check against
 * @returns {Promise<boolean>} - True if user can access team data
 */
export const canAccessTeam = async (user, teamId, prisma) => {
  if (!user || !teamId) return false;
  
  // Admins can access all teams
  if (isAdmin(user)) return true;
  
  // Check if user is the team lead
  const teamLeadCheck = await isTeamLead(user, teamId, prisma);
  if (teamLeadCheck) return true;
  
  // Check if user is a team member
  const memberCheck = await isTeamMember(user, teamId, prisma);
  return memberCheck;
};