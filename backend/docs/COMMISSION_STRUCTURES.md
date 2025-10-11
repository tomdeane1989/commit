# Advanced Commission Structures

## Overview

This document defines the commission structure configurations supported by the system. Commission structures can be stored in the `commission_structure` JSON field on targets.

## Commission Structure Types

### 1. Base Commission
Simple percentage-based commission.

```json
{
  "type": "base_rate",
  "rate": 0.05,  // 5%
  "description": "5% commission on all deals"
}
```

### 2. Tiered Commission
Progressive rates based on total sales achievement.

```json
{
  "type": "tiered",
  "tier_type": "graduated",  // or "cliff"
  "tiers": [
    {
      "threshold_min": 0,
      "threshold_max": 50000,
      "rate": 0.03,  // 3% for £0-£50k
      "description": "Base tier"
    },
    {
      "threshold_min": 50000,
      "threshold_max": 100000,
      "rate": 0.05,  // 5% for £50k-£100k
      "description": "Mid tier"
    },
    {
      "threshold_min": 100000,
      "threshold_max": null,  // unlimited
      "rate": 0.07,  // 7% for £100k+
      "description": "Top tier"
    }
  ]
}
```

**Tier Types:**
- `graduated`: Each tier applies to its portion only (e.g., 3% on first £50k, 5% on next £50k)
- `cliff`: Entire commission at highest tier rate once reached

### 3. Accelerators
Multipliers that boost commission when quota thresholds are exceeded.

```json
{
  "type": "accelerator",
  "name": "Quota Accelerator",
  "accelerators": [
    {
      "threshold": 100,  // 100% of quota
      "multiplier": 1.0,  // Standard rate
      "description": "At quota"
    },
    {
      "threshold": 110,  // 110% of quota
      "multiplier": 1.25,  // 25% boost
      "description": "Exceed quota by 10%"
    },
    {
      "threshold": 125,  // 125% of quota
      "multiplier": 1.5,  // 50% boost
      "description": "Exceed quota by 25%"
    },
    {
      "threshold": 150,  // 150% of quota
      "multiplier": 2.0,  // Double commission
      "description": "Exceed quota by 50%"
    }
  ],
  "apply_to": "all"  // or "incremental" (only to deals beyond threshold)
}
```

### 4. Decelerators
Reduce commission rates when performance is below target.

```json
{
  "type": "decelerator",
  "name": "Underperformance Penalty",
  "decelerators": [
    {
      "threshold": 90,  // Below 90% of quota
      "multiplier": 0.8,  // 20% reduction
      "description": "10% below quota"
    },
    {
      "threshold": 75,  // Below 75% of quota
      "multiplier": 0.6,  // 40% reduction
      "description": "25% below quota"
    },
    {
      "threshold": 50,  // Below 50% of quota
      "multiplier": 0.5,  // 50% reduction
      "description": "50% below quota"
    }
  ]
}
```

### 5. Performance Gates
Minimum thresholds that must be met before commission is paid.

```json
{
  "type": "performance_gate",
  "gates": [
    {
      "metric": "quota_attainment",
      "operator": ">=",
      "value": 70,  // Must hit 70% of quota
      "penalty": "zero_commission",  // or "reduced_rate"
      "reduced_rate": 0.5,  // If penalty is "reduced_rate"
      "description": "Minimum 70% quota attainment required"
    },
    {
      "metric": "activity_count",
      "operator": ">=",
      "value": 50,  // Must log 50+ activities
      "penalty": "zero_commission",
      "description": "Minimum activity threshold"
    }
  ]
}
```

### 6. Team Splits
Split commission between multiple team members.

```json
{
  "type": "team_split",
  "splits": [
    {
      "role": "sales_rep",
      "user_id": "user_123",
      "percentage": 70,
      "description": "Primary sales rep"
    },
    {
      "role": "sales_engineer",
      "user_id": "user_456",
      "percentage": 20,
      "description": "Technical support"
    },
    {
      "role": "manager",
      "user_id": "user_789",
      "percentage": 10,
      "description": "Team lead override"
    }
  ],
  "split_method": "percentage"  // or "fixed_amounts"
}
```

### 7. Product-Specific Rates
Different commission rates for different products/categories.

```json
{
  "type": "product_rate",
  "default_rate": 0.05,
  "products": [
    {
      "product_category_id": "cat_123",
      "rate": 0.08,
      "description": "High margin products"
    },
    {
      "product_category_id": "cat_456",
      "rate": 0.03,
      "description": "Low margin products"
    }
  ]
}
```

### 8. Bonus/SPIFF
Fixed amount bonuses for specific achievements.

```json
{
  "type": "bonus",
  "bonuses": [
    {
      "name": "New Logo Bonus",
      "amount": 500,
      "conditions": {
        "deal_type": "new_customer",
        "min_amount": 10000
      },
      "description": "£500 for new customers over £10k"
    },
    {
      "name": "Q4 SPIFF",
      "amount": 1000,
      "conditions": {
        "month": [10, 11, 12],
        "product_category": "software"
      },
      "description": "£1000 Q4 software bonus"
    }
  ]
}
```

## Composite Structures

You can combine multiple structures in a single target:

```json
{
  "structures": [
    {
      "type": "tiered",
      "priority": 1,
      "tier_type": "graduated",
      "tiers": [...],
      "calculation_type": "replace"  // Base calculation
    },
    {
      "type": "accelerator",
      "priority": 2,
      "accelerators": [...],
      "calculation_type": "multiply"  // Applied to result
    },
    {
      "type": "bonus",
      "priority": 3,
      "bonuses": [...],
      "calculation_type": "add"  // Added to result
    }
  ]
}
```

## Performance Gates Structure

Performance gates are stored separately in the `performance_gates` field:

```json
{
  "gates": [
    {
      "id": "gate_1",
      "name": "Minimum Quota Attainment",
      "metric": "quota_attainment",
      "operator": ">=",
      "value": 70,
      "enforcement": "hard",  // "hard" = no commission, "soft" = warning only
      "penalty_type": "zero_commission",  // or "percentage_reduction"
      "penalty_value": null,  // or percentage to reduce (e.g., 50 for 50% reduction)
      "description": "Must achieve at least 70% of quota"
    },
    {
      "id": "gate_2",
      "name": "Deal Quality Check",
      "metric": "average_deal_size",
      "operator": ">=",
      "value": 5000,
      "enforcement": "soft",
      "penalty_type": "percentage_reduction",
      "penalty_value": 25,  // 25% commission reduction
      "description": "Average deal size should be £5000+"
    }
  ],
  "evaluation_period": "monthly",  // or "quarterly", "annual"
  "evaluation_method": "all_must_pass"  // or "any_must_pass"
}
```

## Calculation Priority

When multiple structures are defined:

1. **Performance Gates** - Evaluated first, may block commission entirely
2. **Base/Tiered Calculation** - Determines base commission amount
3. **Accelerators/Decelerators** - Applied as multipliers to base
4. **Bonuses** - Added to final amount
5. **Team Splits** - Applied last to distribute final amount

## Implementation Notes

- All monetary values in base currency (GBP)
- Percentages stored as decimals (0.05 = 5%)
- Thresholds are percentages of quota (100 = 100% of quota)
- Calculations use Decimal.js for precision
- Historical commission structures are immutable (stored with commission record)

## Examples

### Example 1: Sales Rep with Accelerators
```json
{
  "commission_structure": {
    "type": "accelerator",
    "base_rate": 0.05,
    "accelerators": [
      { "threshold": 100, "multiplier": 1.0 },
      { "threshold": 110, "multiplier": 1.5 },
      { "threshold": 125, "multiplier": 2.0 }
    ]
  },
  "performance_gates": {
    "gates": [
      {
        "metric": "quota_attainment",
        "operator": ">=",
        "value": 70,
        "enforcement": "hard",
        "penalty_type": "zero_commission"
      }
    ]
  }
}
```

### Example 2: Manager with Team Overrides
```json
{
  "commission_structure": {
    "type": "team_override",
    "base_rate": 0.02,
    "conditions": {
      "applies_to": "team_deals",
      "max_per_deal": 1000
    }
  }
}
```

### Example 3: Product Specialist
```json
{
  "commission_structure": {
    "structures": [
      {
        "type": "product_rate",
        "priority": 1,
        "products": [
          { "category": "PS", "rate": 0.08 },
          { "category": "Software", "rate": 0.05 },
          { "category": "Hardware", "rate": 0.03 }
        ]
      },
      {
        "type": "bonus",
        "priority": 2,
        "bonuses": [
          {
            "name": "PS Expertise Bonus",
            "amount": 250,
            "conditions": { "category": "PS", "min_amount": 20000 }
          }
        ]
      }
    ]
  }
}
```
