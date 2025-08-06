# Commission Automation Recommendations

## Executive Summary
The current commission system requires manual calculation, missing a critical opportunity for real-time forecasting and performance tracking. This document outlines a comprehensive solution for automatic commission calculation with both projected and actual commission tracking.

## Current State Issues
1. **No automatic triggers** - Commissions must be manually calculated
2. **No forecasting capability** - Open deals don't show projected commissions
3. **Stale data** - Commission data becomes outdated as deals change
4. **Poor UX** - Users don't know when to recalculate
5. **Team visibility gaps** - Managers can't see real-time team performance

## Proposed Solution Architecture

### 1. Dual Commission Tracking System

#### Database Schema Changes
```sql
-- Add to existing commissions table
ALTER TABLE commissions ADD COLUMN commission_type ENUM('actual', 'projected') DEFAULT 'actual';
ALTER TABLE commissions ADD COLUMN last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE commissions ADD COLUMN calculation_trigger VARCHAR(50); -- 'manual', 'deal_closed', 'deal_updated', 'sync', etc.

-- Or create separate projected_commissions table for cleaner separation
CREATE TABLE projected_commissions (
  -- Same structure as commissions table
  -- But for open deals (pipeline, commit, best_case)
);

-- Add to deals table for quick commission lookups
ALTER TABLE deals ADD COLUMN projected_commission DECIMAL(12,2);
ALTER TABLE deals ADD COLUMN actual_commission DECIMAL(12,2);
```

### 2. Automatic Calculation Triggers

#### A. Deal Lifecycle Triggers
```javascript
// In deals.js routes

// Helper function to calculate commission for a deal
async function calculateDealCommission(deal, userId) {
  // Get user's active target for the deal's close date
  const target = await getActiveTargetForPeriod(userId, deal.close_date);
  if (!target) return 0;
  
  return deal.amount * target.commission_rate;
}

// Trigger on deal create/update
async function handleDealChange(deal, previousDeal = null) {
  const isNewDeal = !previousDeal;
  const statusChanged = previousDeal?.status !== deal.status;
  const amountChanged = previousDeal?.amount !== deal.amount;
  const closeDateChanged = previousDeal?.close_date !== deal.close_date;
  
  if (isNewDeal || statusChanged || amountChanged || closeDateChanged) {
    // Calculate projected commission for all deals
    const projectedCommission = await calculateDealCommission(deal, deal.user_id);
    
    // Update deal with commission amounts
    await prisma.deals.update({
      where: { id: deal.id },
      data: {
        projected_commission: deal.status !== 'closed_won' ? projectedCommission : 0,
        actual_commission: deal.status === 'closed_won' ? projectedCommission : 0
      }
    });
    
    // Trigger period recalculation
    await recalculateCommissionPeriod(deal.user_id, deal.close_date, deal.status);
  }
}

// Recalculate entire period when deals change
async function recalculateCommissionPeriod(userId, dealDate, dealStatus) {
  const period = getPeriodForDate(dealDate); // Based on payment schedule
  
  if (dealStatus === 'closed_won') {
    // Update ACTUAL commissions
    await updateActualCommissions(userId, period);
  }
  
  // Always update PROJECTED commissions for the period
  await updateProjectedCommissions(userId, period);
}
```

#### B. Real-time Calculation Functions
```javascript
// Calculate actual commissions (closed_won deals only)
async function updateActualCommissions(userId, period) {
  const closedDeals = await prisma.deals.findMany({
    where: {
      user_id: userId,
      status: 'closed_won',
      close_date: {
        gte: period.start,
        lte: period.end
      }
    }
  });
  
  const totalAmount = closedDeals.reduce((sum, deal) => sum + deal.amount, 0);
  const target = await getActiveTargetForPeriod(userId, period.start);
  
  if (target) {
    const commission = totalAmount * target.commission_rate;
    const attainment = (totalAmount / target.quota_amount) * 100;
    
    // Upsert actual commission record
    await prisma.commissions.upsert({
      where: { unique_user_period_actual },
      create: {
        user_id: userId,
        period_start: period.start,
        period_end: period.end,
        commission_type: 'actual',
        quota_amount: target.quota_amount,
        actual_amount: totalAmount,
        commission_earned: commission,
        attainment_pct: attainment,
        calculation_trigger: 'deal_closed',
        // ... other fields
      },
      update: {
        actual_amount: totalAmount,
        commission_earned: commission,
        attainment_pct: attainment,
        last_calculated_at: new Date(),
        calculation_trigger: 'deal_updated'
      }
    });
  }
}

// Calculate projected commissions (all open deals)
async function updateProjectedCommissions(userId, period) {
  const openDeals = await prisma.deals.findMany({
    where: {
      user_id: userId,
      status: { in: ['pipeline', 'commit', 'best_case'] },
      close_date: {
        gte: period.start,
        lte: period.end
      }
    }
  });
  
  // Calculate weighted projections based on deal stage
  const projectedByCategory = {
    pipeline: { amount: 0, weight: 0.1 },      // 10% probability
    commit: { amount: 0, weight: 0.75 },       // 75% probability
    best_case: { amount: 0, weight: 0.25 }     // 25% probability
  };
  
  openDeals.forEach(deal => {
    const category = deal.category || 'pipeline';
    projectedByCategory[category].amount += deal.amount;
  });
  
  const weightedProjectedAmount = Object.values(projectedByCategory)
    .reduce((sum, cat) => sum + (cat.amount * cat.weight), 0);
  
  const target = await getActiveTargetForPeriod(userId, period.start);
  
  if (target) {
    const projectedCommission = weightedProjectedAmount * target.commission_rate;
    const projectedAttainment = ((totalActualAmount + weightedProjectedAmount) / target.quota_amount) * 100;
    
    // Store projected commission separately or with type flag
    await prisma.commissions.upsert({
      where: { unique_user_period_projected },
      create: {
        user_id: userId,
        period_start: period.start,
        period_end: period.end,
        commission_type: 'projected',
        quota_amount: target.quota_amount,
        actual_amount: weightedProjectedAmount,
        commission_earned: projectedCommission,
        attainment_pct: projectedAttainment,
        // ... other fields
      },
      update: {
        actual_amount: weightedProjectedAmount,
        commission_earned: projectedCommission,
        attainment_pct: projectedAttainment,
        last_calculated_at: new Date()
      }
    });
  }
}
```

### 3. Frontend Display Changes

#### Dashboard (Forecasting View)
```typescript
// Show both actual and projected
interface DashboardMetrics {
  actual: {
    currentPeriodCommission: number;
    ytdCommission: number;
    attainment: number;
  };
  projected: {
    currentPeriodCommission: number;
    ytdAttainment: number;
    pipelineValue: number;
    commitValue: number;
    bestCaseValue: number;
  };
  combined: {
    forecastedCommission: number; // actual + weighted projected
    forecastedAttainment: number;
  };
}
```

#### Commissions Page (Performance View)
```typescript
// Only show ACTUAL commissions
const { data: commissions } = useQuery({
  queryKey: ['commissions', view],
  queryFn: () => api.get('/commissions', {
    params: {
      commission_type: 'actual', // Only actual for performance tracking
      view: managerView
    }
  })
});
```

### 4. Implementation Triggers

1. **Deal Creation** → Calculate projected commission
2. **Deal Update** → Recalculate both projected and actual (if status = closed_won)
3. **Deal Deletion** → Remove from calculations
4. **CRM Sync** → Batch recalculate for all affected periods
5. **Target Changes** → Recalculate all commissions for affected periods
6. **Deal Categorization** → Update projected weights

### 5. Performance Optimization

```javascript
// Use database triggers for instant updates
CREATE OR REPLACE FUNCTION calculate_deal_commission()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate commission based on deal amount and user's target
  -- Update deals table with commission amounts
  -- Queue period recalculation
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deal_commission_trigger
AFTER INSERT OR UPDATE ON deals
FOR EACH ROW
EXECUTE FUNCTION calculate_deal_commission();
```

### 6. Benefits

1. **Real-time Visibility** - Commissions update instantly as deals change
2. **Accurate Forecasting** - See projected earnings based on pipeline
3. **No Manual Steps** - Fully automated calculation
4. **Performance Tracking** - Clear separation of actual vs projected
5. **Audit Trail** - Track what triggered each calculation

### 7. Migration Strategy

1. **Phase 1**: Add commission fields to deals table
2. **Phase 2**: Implement calculation triggers on deal changes
3. **Phase 3**: Backfill historical commission data
4. **Phase 4**: Update UI to show projected vs actual
5. **Phase 5**: Remove manual calculation buttons

## Technical Implementation Priority

1. **High Priority**
   - Add deal update triggers for closed_won status
   - Calculate actual commissions automatically
   - Update team performance queries

2. **Medium Priority**
   - Add projected commission calculations
   - Update dashboard for forecasting
   - Implement weighted probability calculations

3. **Lower Priority**
   - Database triggers for performance
   - Advanced forecasting algorithms
   - Historical data migration

This approach ensures commission data is always fresh, forecasting is accurate, and users never need to manually trigger calculations.