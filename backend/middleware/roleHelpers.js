// Role and permission helper functions

/**
 * Check if user has admin permissions
 * @param {Object} user - The user object from req.user
 * @returns {boolean} - True if user has admin permissions
 */
export const isAdmin = (user) => {
  return user && user.is_admin === true;
};

/**
 * Check if user has manager permissions (including admin)
 * @param {Object} user - The user object from req.user
 * @returns {boolean} - True if user is a manager or admin
 */
export const isManager = (user) => {
  return user && (user.is_admin === true || user.is_manager === true);
};

/**
 * Check if user has manager or admin permissions
 * @param {Object} user - The user object from req.user
 * @returns {boolean} - True if user is a manager or admin
 */
export const canManageTeam = (user) => {
  return user && (user.is_admin === true || user.is_manager === true);
};

/**
 * Check if user can view all teams (admin or has override permission)
 * @param {Object} user - The user object from req.user
 * @returns {boolean} - True if user can view all teams
 */
export const canViewAllTeams = (user) => {
  return user && (user.is_admin === true || user.can_view_all_teams === true);
};

/**
 * Check if user can view specific team data (admin, override, or has direct reports in team)
 * @param {Object} user - The user object from req.user
 * @param {Array} teamMembers - Array of team members to check against
 * @returns {boolean} - True if user can view the team data
 */
export const canViewTeamData = (user, teamMembers = []) => {
  if (!user) return false;
  
  // Admin or override permission grants full access
  if (user.is_admin === true || user.can_view_all_teams === true) {
    return true;
  }
  
  // Non-managers can't view team data
  if (!user.is_manager) return false;
  
  // Managers can view teams where they have direct reports
  return teamMembers.some(member => member.reports_to_id === user.id);
};

/**
 * Check if user can perform admin-only actions
 * @param {Object} user - The user object from req.user
 * @returns {boolean} - True if user has admin permissions
 */
export const canPerformAdminActions = (user) => {
  return isAdmin(user);
};

/**
 * Check if user is a regular sales rep
 * @param {Object} user - The user object from req.user
 * @returns {boolean} - True if user is a sales rep
 */
export const isSalesRep = (user) => {
  return user && user.role === 'sales_rep';
};