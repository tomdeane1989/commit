/**
 * Target Naming Convention Utility
 * 
 * Format: "{USER_INITIALS}-{PERIOD_TYPE}-{YEAR}[-{QUARTER/MONTH}]"
 * Examples:
 * - "AF-ANNUAL-2025" (Alfie Ferris Annual 2025)
 * - "AF-Q1-2025" (Alfie Ferris Q1 2025)
 * - "AF-JAN-2025" (Alfie Ferris January 2025)
 * - "TM-ANNUAL-2025" (Tom Manager Annual 2025)
 */

export function generateTargetName(user, periodType, periodStart, periodEnd) {
  if (!user || !periodType || !periodStart) {
    return null;
  }

  // Get user initials
  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
  
  // Ensure we have a proper Date object
  // Handle case where periodStart might be a stringified date like "Wed Jan 01 2025..."
  let startDate;
  if (periodStart instanceof Date) {
    startDate = periodStart;
  } else if (typeof periodStart === 'string') {
    // If it's already stringified with GMT, just parse it
    startDate = new Date(periodStart);
  } else if (periodStart && typeof periodStart === 'object' && periodStart.toDate) {
    // Handle Prisma DateTime objects
    startDate = periodStart.toDate();
  } else {
    startDate = new Date(periodStart);
  }
  
  // Validate the date
  if (isNaN(startDate.getTime())) {
    console.error('Invalid date for target naming:', periodStart);
    return null;
  }
  
  const year = startDate.getUTCFullYear();
  
  // Generate period identifier based on type
  let periodId;
  switch (periodType.toLowerCase()) {
    case 'annual':
    case 'yearly':
      periodId = `ANNUAL-${year}`;
      break;
      
    case 'quarterly':
      // Determine quarter from start month
      const month = startDate.getUTCMonth();
      const quarter = Math.floor(month / 3) + 1;
      periodId = `Q${quarter}-${year}`;
      break;
      
    case 'monthly':
      // Use month abbreviation
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 
                         'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      periodId = `${monthNames[startDate.getUTCMonth()]}-${year}`;
      break;
      
    case 'weekly':
      // Calculate week number
      const weekNum = getWeekNumber(startDate);
      periodId = `W${weekNum}-${year}`;
      break;
      
    default:
      // Fallback to date range
      const endDate = new Date(periodEnd);
      const startStr = `${startDate.getUTCMonth() + 1}/${startDate.getUTCDate()}`;
      const endStr = `${endDate.getUTCMonth() + 1}/${endDate.getUTCDate()}`;
      periodId = `${startStr}-${endStr}/${year}`;
  }
  
  return `${initials}-${periodId}`;
}

/**
 * Generate a descriptive target label for UI display
 */
export function generateTargetLabel(user, periodType, periodStart, periodEnd, quota, rate) {
  const name = generateTargetName(user, periodType, periodStart, periodEnd);
  const quotaStr = quota ? ` (£${quota.toLocaleString()})` : '';
  const rateStr = rate ? ` @ ${(rate * 100).toFixed(1)}%` : '';
  
  return `${name}${quotaStr}${rateStr}`;
}

/**
 * Parse a target name to extract components
 */
export function parseTargetName(targetName) {
  if (!targetName) return null;
  
  const parts = targetName.split('-');
  if (parts.length < 3) return null;
  
  return {
    initials: parts[0],
    periodType: parts[1],
    year: parts[parts.length - 1],
    period: parts.slice(1).join('-')
  };
}

/**
 * Get ISO week number
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export default {
  generateTargetName,
  generateTargetLabel,
  parseTargetName
};