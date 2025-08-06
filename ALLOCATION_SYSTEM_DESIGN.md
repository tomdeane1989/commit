# Configurable Target Allocation System

## Problem Statement
Current system has multiple duplicate targets per rep (annual £480k, quarterly £120k, monthly £40k) causing confusion and scaling issues. Need single canonical target with flexible allocation patterns.

## Solution: Company-Configurable Allocation Patterns

### Database Schema

```sql
-- Company-specific allocation patterns (reusable configurations)
CREATE TABLE allocation_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  pattern_name VARCHAR(100) NOT NULL, -- "UK Tech Sales 2025", "SaaS Ramp Pattern"
  description TEXT,
  base_period_type VARCHAR(20) NOT NULL, -- "annual", "quarterly", "monthly"
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Flexible period definitions within allocation patterns  
CREATE TABLE allocation_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
  allocation_pattern_id UUID NOT NULL REFERENCES allocation_patterns(id) ON DELETE CASCADE,
  period_name VARCHAR(50) NOT NULL, -- "Q1 2025", "Jan 2025", "H1 Ramp", "Peak Season"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  allocation_percentage DECIMAL(5,2) NOT NULL, -- 0.00 to 100.00
  notes TEXT, -- "Holiday slowdown", "New hire ramp", "Peak selling season"
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Single canonical targets (no more duplicates!)
CREATE TABLE targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  -- Core target amount (annual baseline)
  annual_quota_amount DECIMAL(12,2) NOT NULL,
  commission_rate DECIMAL(5,4) NOT NULL,
  
  -- Link to allocation pattern (optional - defaults to even distribution)  
  allocation_pattern_id UUID REFERENCES allocation_patterns(id),
  
  -- Target metadata
  target_year INTEGER NOT NULL,
  role VARCHAR(50),
  territory VARCHAR(50),
  team_target BOOLEAN DEFAULT false,
  parent_target_id UUID REFERENCES targets(id), -- For team aggregation
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, target_year, team_target) -- One target per user per year
);

-- Pre-calculated allocation values (for performance)
CREATE TABLE target_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  allocation_period_id UUID NOT NULL REFERENCES allocation_periods(id),
  
  -- Calculated values
  period_quota_amount DECIMAL(12,2) NOT NULL,
  period_start_date DATE NOT NULL,  
  period_end_date DATE NOT NULL,
  allocation_percentage DECIMAL(5,2) NOT NULL,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(target_id, allocation_period_id)
);
```

### Example Usage Scenarios

#### Scenario 1: UK Tech Company with Seasonal Patterns
```sql
-- Create company-specific allocation pattern
INSERT INTO allocation_patterns (company_id, pattern_name, description, base_period_type) 
VALUES ('company-123', 'UK Tech Sales 2025', 'Accounts for Q4 holidays and Q1 budget cycles', 'quarterly');

-- Define seasonal quarters with different weightings
INSERT INTO allocation_periods (allocation_pattern_id, period_name, start_date, end_date, allocation_percentage, notes) VALUES 
('pattern-456', 'Q1 2025', '2025-01-01', '2025-03-31', 30.0, 'Budget planning season - higher activity'),
('pattern-456', 'Q2 2025', '2025-04-01', '2025-06-30', 28.0, 'Spring selling season'),  
('pattern-456', 'Q3 2025', '2025-07-01', '2025-09-30', 25.0, 'Summer slowdown'),
('pattern-456', 'Q4 2025', '2025-10-01', '2025-12-31', 17.0, 'Holiday season - reduced activity');
```

#### Scenario 2: SaaS Company with New Hire Ramp
```sql
-- Ramp pattern for new hires
INSERT INTO allocation_patterns (company_id, pattern_name, description, base_period_type)
VALUES ('company-123', 'New Hire 6M Ramp', '6-month progressive ramp to full quota', 'monthly');

INSERT INTO allocation_periods (allocation_pattern_id, period_name, start_date, end_date, allocation_percentage) VALUES
('pattern-789', 'Month 1', '2025-01-01', '2025-01-31', 5.0),   -- 5% of annual
('pattern-789', 'Month 2', '2025-02-01', '2025-02-28', 10.0),  -- 10% of annual  
('pattern-789', 'Month 3', '2025-03-01', '2025-03-31', 15.0),  -- 15% of annual
('pattern-789', 'Month 4', '2025-04-01', '2025-04-30', 20.0),  -- 20% of annual
('pattern-789', 'Month 5', '2025-05-01', '2025-05-31', 25.0),  -- 25% of annual
('pattern-789', 'Month 6', '2025-06-01', '2025-06-30', 25.0);  -- 25% of annual (100% total)
```

#### Scenario 3: Manufacturing with Custom Seasons  
```sql
-- Custom seasonal pattern for manufacturing
INSERT INTO allocation_patterns (company_id, pattern_name, description, base_period_type)
VALUES ('company-456', 'Manufacturing Seasons 2025', 'Pre-summer buildup and post-holiday surge', 'custom');

INSERT INTO allocation_periods (allocation_pattern_id, period_name, start_date, end_date, allocation_percentage, notes) VALUES
('pattern-999', 'Winter Prep', '2025-01-01', '2025-02-28', 15.0, 'Post-holiday recovery'),
('pattern-999', 'Spring Buildup', '2025-03-01', '2025-05-31', 35.0, 'Pre-summer manufacturing surge'), 
('pattern-999', 'Summer Peak', '2025-06-01', '2025-08-31', 30.0, 'Peak production season'),
('pattern-999', 'Fall Preparation', '2025-09-01', '2025-11-30', 15.0, 'Preparation for next cycle'),
('pattern-999', 'Holiday Slowdown', '2025-12-01', '2025-12-31', 5.0, 'Reduced activity');
```

### Key Benefits

1. **Maximum Flexibility**: Organizations define their own patterns
2. **Single Source of Truth**: One target per rep per year  
3. **Reusable Patterns**: Apply same allocation to multiple reps
4. **Custom Periods**: Not limited to calendar quarters/months
5. **Easy Modifications**: Change patterns without touching individual targets
6. **Performance**: Pre-calculated allocations for fast queries
7. **Audit Trail**: Track pattern changes and applications

### Implementation Approach

1. **Migration Strategy**: Convert existing multi-targets to single targets
2. **Default Patterns**: Provide starter patterns (Even Quarterly, Even Monthly)
3. **Pattern Builder UI**: Visual interface for creating allocation patterns
4. **Assignment Interface**: Bulk assign patterns to groups of reps
5. **Calculation Engine**: Background job to update target_allocations when patterns change

### API Endpoints

```javascript
// Pattern Management
GET /api/allocation-patterns              // List company patterns
POST /api/allocation-patterns             // Create new pattern
PUT /api/allocation-patterns/:id          // Update pattern
DELETE /api/allocation-patterns/:id       // Deactivate pattern

// Target Management (Simplified)
GET /api/targets                          // List targets with calculated periods
POST /api/targets                         // Create single annual target
PUT /api/targets/:id/allocation-pattern   // Assign allocation pattern

// Period Calculations  
GET /api/targets/:id/periods/:period      // Get quota for specific period
GET /api/targets/bulk-calculate           // Recalculate all allocations
```

This system gives you complete control over how quotas are distributed throughout the year while maintaining clean, scalable data architecture.