# Sales Commission SaaS - Allocation System Database Design

## 📋 **Overview**

This document details the comprehensive allocation system that was implemented to replace the deprecated seasonal distribution approach. The new system provides flexible, reusable allocation patterns that organizations can customize for their specific quota distribution needs.

## 🗄️ **Database Schema Changes**

### **New Tables Added**

#### 1. `allocation_patterns`
**Purpose**: Store reusable quota allocation templates at the organization level

```sql
CREATE TABLE allocation_patterns (
  id                String    @id @default(cuid())
  pattern_name      String                              -- e.g., "UK Tech Sales 2025"
  description       String?                             -- Optional usage description
  base_period_type  String                              -- quarterly, monthly, annual, custom
  is_active         Boolean   @default(true)            -- Soft delete flag
  company_id        String                              -- Multi-tenant isolation
  created_by_id     String                              -- Audit trail
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt
  
  -- Relationships
  allocation_periods allocation_periods[]               -- Child periods
  targets           targets[]                           -- Targets using this pattern
  created_by        users     @relation(fields: [created_by_id], references: [id])
  company          companies @relation(fields: [company_id], references: [id])
)
```

**Key Features**:
- **Multi-tenant**: Isolated by `company_id`
- **Reusable**: Multiple targets can reference the same pattern
- **Audit trail**: Tracks creator and timestamps
- **Soft delete**: Uses `is_active` flag to preserve historical data

#### 2. `allocation_periods`
**Purpose**: Define specific time periods and percentage allocations within a pattern

```sql
CREATE TABLE allocation_periods (
  id                     String    @id @default(cuid())
  allocation_pattern_id  String                          -- Parent pattern
  period_name           String                          -- e.g., "Q1 2025", "H1 2025"
  start_date            DateTime                        -- Period start
  end_date              DateTime                        -- Period end
  allocation_percentage Decimal   @db.Decimal(5,2)      -- 0.00 to 100.00
  notes                 String?                         -- Optional notes
  sort_order            Int                             -- Display ordering
  created_at            DateTime  @default(now())
  
  -- Relationships
  allocation_pattern    allocation_patterns @relation(fields: [allocation_pattern_id], references: [id], onDelete: Cascade)
  target_allocations    target_allocations[]            -- Actual quota allocations
)
```

**Key Features**:
- **Flexible periods**: Any date range and percentage combination
- **Validation**: Percentages must total 100% across all periods in a pattern
- **Date validation**: No overlapping periods within the same pattern
- **Cascade delete**: Automatically cleaned up when pattern is deleted

#### 3. `target_allocations`
**Purpose**: Link actual target quotas to specific allocation periods (the operational layer)

```sql
CREATE TABLE target_allocations (
  id                   String    @id @default(cuid())
  target_id           String                           -- Parent target
  allocation_period_id String                           -- Reference period
  period_quota_amount  Decimal   @db.Decimal(12,2)     -- Calculated quota for this period
  period_start_date   DateTime                         -- Denormalized for performance
  period_end_date     DateTime                         -- Denormalized for performance
  allocation_percentage Decimal  @db.Decimal(5,2)      -- Denormalized percentage
  created_at          DateTime  @default(now())
  
  -- Relationships
  target              targets            @relation(fields: [target_id], references: [id], onDelete: Cascade)
  allocation_period   allocation_periods @relation(fields: [allocation_period_id], references: [id], onDelete: Cascade)
)
```

**Key Features**:
- **Operational data**: Links abstract patterns to concrete quota amounts
- **Denormalized fields**: Performance optimization for common queries
- **Cascade delete**: Maintains referential integrity
- **Audit trail**: Preserves historical allocation decisions

### **Modified Tables**

#### Updated `targets` Table
**New Fields Added**:

```sql
-- Added to existing targets table
allocation_pattern_id   String?                         -- Link to allocation pattern
distribution_method     String?                         -- 'even', 'allocation-pattern', 'custom'
distribution_config     Json?                           -- Metadata about distribution setup
target_year            Int?                             -- Year for fiscal planning
annual_quota_amount    Decimal?  @db.Decimal(12,2)      -- Total annual quota reference
```

**Key Changes**:
- **Pattern linking**: Direct reference to allocation pattern used
- **Distribution tracking**: Metadata about how quota was distributed
- **Fiscal planning**: Year-based grouping for annual planning
- **Historical preservation**: Original quota amounts maintained

## 🏗️ **System Architecture**

### **Three-Layer Design**

#### 1. **Template Layer** (`allocation_patterns` + `allocation_periods`)
- **Purpose**: Reusable organizational templates
- **Scope**: Company-wide, configurable by admins
- **Examples**: "Standard Quarterly", "Holiday Adjusted", "Product Launch Cycle"
- **Lifecycle**: Long-lived, reused across multiple targets

#### 2. **Assignment Layer** (`targets`)
- **Purpose**: Link users/teams to allocation patterns with specific quotas
- **Scope**: User/team specific, time-bound
- **Metadata**: Pattern selection, creation context, total quota
- **Lifecycle**: Annual or period-specific

#### 3. **Operational Layer** (`target_allocations`)
- **Purpose**: Concrete quota amounts for performance tracking
- **Scope**: Period-specific, calculated amounts
- **Usage**: Commission calculations, performance dashboards, forecasting
- **Lifecycle**: Immutable once created (historical integrity)

### **Data Flow**

```
1. Admin creates allocation_pattern
   ↓
2. Periods defined with percentages (must total 100%)
   ↓
3. Manager assigns pattern to user via QuotaWizard
   ↓
4. System creates target record with pattern reference
   ↓
5. System calculates and creates target_allocations
   ↓
6. Commission engine uses target_allocations for payouts
```

## 🎯 **Integration with Deals/Targets/Quotas**

### **Quota Planning Workflow**

#### 1. **Pattern Creation** (Admin)
```sql
-- Create reusable pattern
INSERT INTO allocation_patterns (pattern_name, company_id, base_period_type)
VALUES ('UK Sales 2025', 'company_123', 'quarterly');

-- Define periods (must total 100%)
INSERT INTO allocation_periods (allocation_pattern_id, period_name, start_date, end_date, allocation_percentage)
VALUES 
  ('pattern_123', 'Q1 2025', '2025-01-01', '2025-03-31', 25.00),
  ('pattern_123', 'Q2 2025', '2025-04-01', '2025-06-30', 25.00),
  ('pattern_123', 'Q3 2025', '2025-07-01', '2025-09-30', 25.00),
  ('pattern_123', 'Q4 2025', '2025-10-01', '2025-12-31', 25.00);
```

#### 2. **Target Assignment** (Manager)
```sql
-- Create annual target with pattern reference
INSERT INTO targets (user_id, quota_amount, allocation_pattern_id, distribution_method, target_year)
VALUES ('user_123', 200000.00, 'pattern_123', 'allocation-pattern', 2025);

-- System automatically creates allocations
INSERT INTO target_allocations (target_id, allocation_period_id, period_quota_amount, period_start_date, period_end_date)
VALUES 
  ('target_123', 'period_q1', 50000.00, '2025-01-01', '2025-03-31'),
  ('target_123', 'period_q2', 50000.00, '2025-04-01', '2025-06-30'),
  -- ... etc
```

### **Deal Attribution & Commission Calculation**

#### Current Period Target Resolution
```sql
-- Find current period target for deal attribution
SELECT ta.period_quota_amount, ta.allocation_percentage
FROM target_allocations ta
JOIN targets t ON ta.target_id = t.id
WHERE t.user_id = :user_id 
  AND t.is_active = true
  AND :deal_close_date BETWEEN ta.period_start_date AND ta.period_end_date;
```

#### Performance Tracking
```sql
-- Calculate achievement against allocated quota
SELECT 
  ta.period_quota_amount,
  SUM(d.amount) as actual_sales,
  (SUM(d.amount) / ta.period_quota_amount * 100) as achievement_pct
FROM target_allocations ta
LEFT JOIN deals d ON d.user_id = ta.target.user_id 
  AND d.close_date BETWEEN ta.period_start_date AND ta.period_end_date
  AND d.stage = 'closed_won'
WHERE ta.target_id = :target_id
GROUP BY ta.id;
```

## 👥 **User Management Integration**

### **Role-Based Access Control**

#### **Admin Permissions**
- Create/edit/delete allocation patterns
- View all company patterns and usage statistics
- Manage pattern templates and organizational standards

#### **Manager Permissions**
- View available allocation patterns
- Assign patterns to team members via QuotaWizard
- Create targets using existing patterns
- View team allocation performance

#### **Sales Rep Permissions**
- View own target allocations and periods
- Track progress against allocated quotas
- No pattern creation or modification rights

### **Team-Based Target Management**

#### Team Target Creation
```sql
-- Team targets can also use allocation patterns
INSERT INTO targets (team_target, allocation_pattern_id, quota_amount)
VALUES (true, 'pattern_123', 1000000.00);

-- Individual targets inherit from team patterns
SELECT ap.*, ta.period_quota_amount / team_member_count as individual_allocation
FROM allocation_patterns ap
JOIN targets team_target ON ap.id = team_target.allocation_pattern_id
JOIN target_allocations ta ON team_target.id = ta.target_id
WHERE team_target.team_target = true;
```

#### Hierarchical Quota Distribution
```sql
-- Roll up individual performance to team level
SELECT 
  t.id as team_target_id,
  ta.period_name,
  ta.period_quota_amount as team_quota,
  SUM(individual_ta.period_quota_amount) as allocated_individual,
  SUM(deals.amount) as team_actual
FROM targets t
JOIN target_allocations ta ON t.id = ta.target_id
JOIN targets individual_t ON individual_t.parent_target_id = t.id
JOIN target_allocations individual_ta ON individual_t.id = individual_ta.target_id
LEFT JOIN deals ON deals.user_id = individual_t.user_id
WHERE t.team_target = true
GROUP BY t.id, ta.id;
```

## 🔒 **Data Integrity & Business Rules**

### **Validation Rules**

#### 1. **Allocation Pattern Validation**
- All periods within a pattern must total exactly 100%
- No overlapping date ranges within the same pattern
- Pattern names must be unique within a company
- At least one period required per pattern

#### 2. **Historical Data Protection**
- Past periods cannot be modified if targets exist
- Patterns with historical usage cannot be hard deleted
- Target allocations are immutable once created
- Date-based protection prevents retroactive changes

#### 3. **Multi-Tenant Isolation**
- All queries filtered by `company_id`
- Users can only access patterns from their company
- Cross-company data leakage prevented by foreign key constraints

### **Database Constraints**

```sql
-- Percentage validation
ALTER TABLE allocation_periods ADD CONSTRAINT chk_percentage 
CHECK (allocation_percentage >= 0 AND allocation_percentage <= 100);

-- Date range validation
ALTER TABLE allocation_periods ADD CONSTRAINT chk_date_range 
CHECK (end_date > start_date);

-- Unique pattern names per company
ALTER TABLE allocation_patterns ADD CONSTRAINT uk_pattern_name_company 
UNIQUE (company_id, pattern_name) WHERE is_active = true;
```

## 📊 **Performance Considerations**

### **Indexing Strategy**

```sql
-- Query optimization indexes
CREATE INDEX idx_allocation_patterns_company_active ON allocation_patterns(company_id, is_active);
CREATE INDEX idx_allocation_periods_pattern_sort ON allocation_periods(allocation_pattern_id, sort_order);
CREATE INDEX idx_target_allocations_target ON target_allocations(target_id);
CREATE INDEX idx_target_allocations_period_dates ON target_allocations(period_start_date, period_end_date);
CREATE INDEX idx_targets_user_year_active ON targets(user_id, target_year, is_active);
```

### **Denormalization for Performance**

Target allocations table includes denormalized fields:
- `period_start_date` / `period_end_date`: Avoid joins for date range queries
- `allocation_percentage`: Direct access without pattern lookup
- `period_quota_amount`: Pre-calculated for commission processing

### **Query Optimization**

```sql
-- Efficient current period lookup
SELECT ta.period_quota_amount 
FROM target_allocations ta
JOIN targets t ON ta.target_id = t.id
WHERE t.user_id = :user_id 
  AND t.is_active = true
  AND NOW() BETWEEN ta.period_start_date AND ta.period_end_date
LIMIT 1;

-- Bulk performance calculation
SELECT user_id, SUM(period_quota_amount) as total_quota
FROM targets t
JOIN target_allocations ta ON t.id = ta.target_id
WHERE t.target_year = 2025 AND t.is_active = true
GROUP BY user_id;
```

## 🚀 **Migration Strategy**

### **Backward Compatibility**

The new system maintains backward compatibility with existing targets:
- Legacy targets without allocation patterns continue to work
- Existing commission calculations unaffected
- Gradual migration path available

### **Migration Process**

1. **Schema Migration**: Add new tables and columns
2. **Data Validation**: Ensure existing targets remain functional
3. **Feature Rollout**: Enable allocation patterns for new targets
4. **Legacy Migration**: Optionally convert old seasonal targets
5. **Cleanup**: Remove deprecated seasonal distribution code

## 📈 **Future Enhancements**

### **Planned Features**

1. **Pattern Versioning**: Track pattern changes over time
2. **Approval Workflows**: Require approval for high-value pattern assignments
3. **Automated Adjustments**: AI-driven pattern optimization based on performance
4. **Template Library**: Industry-specific pattern templates
5. **Real-time Reallocation**: Mid-period quota adjustments with audit trail

### **Scalability Considerations**

- **Horizontal Scaling**: Company-based sharding support
- **Caching Layer**: Pattern and allocation caching for high-traffic queries
- **Archive Strategy**: Historical data archival for long-term storage
- **Analytics Pipeline**: Dedicated read replicas for reporting workloads

---

**Last Updated**: 2025-08-02  
**Version**: 1.0  
**Status**: ✅ Production Ready

This allocation system provides a robust, flexible foundation for quota management that scales with organizational complexity while maintaining data integrity and audit trails essential for commission-based sales operations.