/**
 * Frontend utility functions for monetary calculations and formatting
 * Uses JavaScript's built-in number handling with proper rounding
 */

/**
 * Format a number as currency (GBP)
 * Ensures consistent 2 decimal places
 */
export function formatCurrency(value: number | string | null | undefined, includeSymbol = true): string {
  const numValue = parseFloat(String(value || 0));
  
  if (isNaN(numValue)) {
    return includeSymbol ? '£0.00' : '0.00';
  }
  
  // Round to 2 decimal places using banker's rounding
  const rounded = Math.round(numValue * 100) / 100;
  const formatted = rounded.toFixed(2);
  
  return includeSymbol ? `£${formatted}` : formatted;
}

/**
 * Format large numbers with comma separators (always 2 decimal places)
 */
export function formatLargeNumber(value: number | string | null | undefined): string {
  const numValue = parseFloat(String(value || 0));
  
  if (isNaN(numValue)) {
    return '0.00';
  }
  
  return numValue.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Format currency with comma separators
 */
export function formatLargeCurrency(value: number | string | null | undefined): string {
  const numValue = parseFloat(String(value || 0));
  
  if (isNaN(numValue)) {
    return '£0.00';
  }
  
  return `£${numValue.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/**
 * Calculate commission with proper precision
 */
export function calculateCommission(amount: number | string, rate: number | string): number {
  const numAmount = parseFloat(String(amount || 0));
  const numRate = parseFloat(String(rate || 0));
  
  if (isNaN(numAmount) || isNaN(numRate)) {
    return 0;
  }
  
  // Round to 2 decimal places
  return Math.round(numAmount * numRate * 100) / 100;
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number | string, total: number | string): number {
  const numValue = parseFloat(String(value || 0));
  const numTotal = parseFloat(String(total || 0));
  
  if (isNaN(numValue) || isNaN(numTotal) || numTotal === 0) {
    return 0;
  }
  
  // Round to 2 decimal places
  return Math.round((numValue / numTotal) * 10000) / 100;
}

/**
 * Sum an array of monetary values
 */
export function sumMoney(values: (number | string | null | undefined)[]): number {
  return values.reduce((sum, value) => {
    const numValue = parseFloat(String(value || 0));
    return sum + (isNaN(numValue) ? 0 : numValue);
  }, 0);
}

/**
 * Calculate attainment percentage
 */
export function calculateAttainment(actual: number | string, target: number | string): number {
  return calculatePercentage(actual, target);
}

/**
 * Parse a monetary input value (from form fields)
 * Handles pound signs, commas, and spaces
 */
export function parseMoney(value: string): number {
  // Remove pound sign, commas, and spaces
  const cleaned = value.replace(/[£,\s]/g, '');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Validate if a value is a valid monetary amount
 */
export function isValidMoney(value: string): boolean {
  const cleaned = value.replace(/[£,\s]/g, '');
  const parsed = parseFloat(cleaned);
  
  return !isNaN(parsed) && parsed >= 0;
}

/**
 * Format percentage with proper precision
 */
export function formatPercentage(value: number | string | null | undefined, decimals = 1): string {
  const numValue = parseFloat(String(value || 0));
  
  if (isNaN(numValue)) {
    return '0%';
  }
  
  return `${numValue.toFixed(decimals)}%`;
}

/**
 * Compare two monetary values for equality (within 1 penny)
 */
export function moneyEquals(a: number | string, b: number | string): boolean {
  const numA = parseFloat(String(a || 0));
  const numB = parseFloat(String(b || 0));
  
  if (isNaN(numA) || isNaN(numB)) {
    return false;
  }
  
  // Consider equal if within 1 penny
  return Math.abs(numA - numB) < 0.01;
}

/**
 * Round to nearest penny
 */
export function roundToPenny(value: number | string): number {
  const numValue = parseFloat(String(value || 0));
  
  if (isNaN(numValue)) {
    return 0;
  }
  
  return Math.round(numValue * 100) / 100;
}

/**
 * Calculate tiered commission
 */
export function calculateTieredCommission(
  amount: number | string,
  tiers: Array<{ threshold: number; rate: number }>
): number {
  const numAmount = parseFloat(String(amount || 0));
  
  if (isNaN(numAmount) || numAmount <= 0) {
    return 0;
  }
  
  // Sort tiers by threshold
  const sortedTiers = [...tiers].sort((a, b) => a.threshold - b.threshold);
  
  let commission = 0;
  
  for (let i = 0; i < sortedTiers.length; i++) {
    const tier = sortedTiers[i];
    const nextTier = sortedTiers[i + 1];
    const tierMax = nextTier ? nextTier.threshold : numAmount;
    
    if (numAmount > tier.threshold) {
      const tierAmount = Math.min(numAmount, tierMax) - tier.threshold;
      commission += tierAmount * tier.rate;
    }
  }
  
  return roundToPenny(commission);
}

export default {
  formatCurrency,
  formatLargeNumber,
  formatLargeCurrency,
  calculateCommission,
  calculatePercentage,
  sumMoney,
  calculateAttainment,
  parseMoney,
  isValidMoney,
  formatPercentage,
  moneyEquals,
  roundToPenny,
  calculateTieredCommission
};