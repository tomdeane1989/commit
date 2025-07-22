// Role and permission helper functions

/**
 * Check if user has admin permissions
 * @param {Object} user - The user object from req.user
 * @returns {boolean} - True if user has admin permissions
 */
export const isAdmin = (user) => {
  return user && user.is_admin === true && user.role === 'manager';
};

/**
 * Check if user has manager permissions (including admin)
 * @param {Object} user - The user object from req.user
 * @returns {boolean} - True if user is a manager or admin
 */
export const isManager = (user) => {
  return user && user.role === 'manager';
};

/**
 * Check if user has manager or admin permissions
 * @param {Object} user - The user object from req.user
 * @returns {boolean} - True if user is a manager or admin
 */
export const canManageTeam = (user) => {
  return user && user.role === 'manager'; // All managers can manage team, admins are managers too
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