// Utility functions for precise monetary calculations
import { Decimal } from 'decimal.js';

// Configure Decimal for monetary calculations
// 2 decimal places for currency, rounding mode similar to financial standards
Decimal.set({ 
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -9,
  toExpPos: 9
});

/**
 * Convert any value to a Decimal instance
 * Handles: numbers, strings, Prisma Decimal objects, null/undefined
 */
export function toDecimal(value) {
  if (value === null || value === undefined) {
    return new Decimal(0);
  }
  
  // Handle Prisma Decimal objects
  if (value && typeof value === 'object' && 'd' in value && 'e' in value && 's' in value) {
    // Prisma Decimal has internal structure {d: digits, e: exponent, s: sign}
    return new Decimal(value.toString());
  }
  
  // Handle regular numbers and strings
  try {
    return new Decimal(value);
  } catch (error) {
    console.error('Invalid decimal value:', value, error);
    return new Decimal(0);
  }
}

/**
 * Format a decimal value as currency (GBP)
 */
export function formatCurrency(value, includeSymbol = true) {
  const decimal = toDecimal(value);
  const formatted = decimal.toFixed(2);
  return includeSymbol ? `£${formatted}` : formatted;
}

/**
 * Calculate commission amount with proper precision
 */
export function calculateCommission(dealAmount, commissionRate) {
  const amount = toDecimal(dealAmount);
  const rate = toDecimal(commissionRate);
  
  // Commission = amount * rate
  const commission = amount.mul(rate);
  
  // Round to 2 decimal places for currency
  return commission.toDecimalPlaces(2);
}

/**
 * Calculate percentage with proper precision
 */
export function calculatePercentage(value, total) {
  if (!total || toDecimal(total).isZero()) {
    return new Decimal(0);
  }
  
  const valueDecimal = toDecimal(value);
  const totalDecimal = toDecimal(total);
  
  // Percentage = (value / total) * 100
  return valueDecimal.div(totalDecimal).mul(100).toDecimalPlaces(2);
}

/**
 * Sum an array of monetary values
 */
export function sumMoney(values) {
  return values.reduce((sum, value) => {
    return sum.add(toDecimal(value));
  }, new Decimal(0));
}

/**
 * Calculate attainment percentage
 */
export function calculateAttainment(actual, target) {
  if (!target || toDecimal(target).isZero()) {
    return new Decimal(0);
  }
  
  const actualDecimal = toDecimal(actual);
  const targetDecimal = toDecimal(target);
  
  // Attainment = (actual / target) * 100
  return actualDecimal.div(targetDecimal).mul(100).toDecimalPlaces(2);
}

/**
 * Convert Decimal to number for database storage
 * Use only when absolutely necessary (prefer keeping as Decimal)
 */
export function toNumber(decimal) {
  return toDecimal(decimal).toNumber();
}

/**
 * Convert Decimal to string for API responses
 */
export function toString(decimal) {
  return toDecimal(decimal).toFixed(2);
}

/**
 * Compare two monetary values
 */
export function compareMoney(a, b) {
  const aDecimal = toDecimal(a);
  const bDecimal = toDecimal(b);
  
  if (aDecimal.gt(bDecimal)) return 1;
  if (aDecimal.lt(bDecimal)) return -1;
  return 0;
}

/**
 * Check if a monetary value is zero
 */
export function isZero(value) {
  return toDecimal(value).isZero();
}

/**
 * Check if a monetary value is positive
 */
export function isPositive(value) {
  return toDecimal(value).gt(0);
}

/**
 * Round to nearest penny (0.01)
 */
export function roundToPenny(value) {
  return toDecimal(value).toDecimalPlaces(2);
}

/**
 * Calculate tiered commission
 * tiers: [{ threshold: 0, rate: 0.05 }, { threshold: 100000, rate: 0.07 }, ...]
 */
export function calculateTieredCommission(amount, tiers) {
  const amountDecimal = toDecimal(amount);
  let commission = new Decimal(0);
  
  // Sort tiers by threshold
  const sortedTiers = [...tiers].sort((a, b) => 
    toDecimal(a.threshold).minus(toDecimal(b.threshold)).toNumber()
  );
  
  for (let i = 0; i < sortedTiers.length; i++) {
    const tier = sortedTiers[i];
    const tierThreshold = toDecimal(tier.threshold);
    const tierRate = toDecimal(tier.rate);
    
    const nextTier = sortedTiers[i + 1];
    const nextThreshold = nextTier ? toDecimal(nextTier.threshold) : amountDecimal;
    
    if (amountDecimal.gt(tierThreshold)) {
      const tierAmount = Decimal.min(amountDecimal, nextThreshold).minus(tierThreshold);
      const tierCommission = tierAmount.mul(tierRate);
      commission = commission.add(tierCommission);
    }
  }
  
  return commission.toDecimalPlaces(2);
}

export default {
  toDecimal,
  formatCurrency,
  calculateCommission,
  calculatePercentage,
  sumMoney,
  calculateAttainment,
  toNumber,
  toString,
  compareMoney,
  isZero,
  isPositive,
  roundToPenny,
  calculateTieredCommission
};