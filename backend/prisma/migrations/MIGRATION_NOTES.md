# Migration Notes

## Recent Manual Fixes (2025-08-05)

Due to schema drift between development environments, the following migrations were created retroactively to ensure consistency when merging to main:

### 1. `20250805_add_is_manager_column`
- **Purpose**: Adds `is_manager` boolean column to users table
- **Why needed**: The column existed in schema.prisma but was missing from some development databases
- **Changes**:
  - Adds `is_manager` column with default `false`
  - Updates existing managers based on `role = 'manager'`
  - Creates index for performance

### 2. `20250805_add_deals_unique_constraint`
- **Purpose**: Adds unique constraint on deals table for CRM synchronization
- **Why needed**: Prevents duplicate deal imports from Google Sheets and other CRM systems
- **Changes**:
  - Adds `unique_crm_deal_per_company` constraint on `[crm_id, company_id]`

## Important Notes

1. These migrations use `IF NOT EXISTS` clauses to be idempotent - they can be safely run on databases that already have these changes
2. When merging to main, these migrations will ensure all environments have consistent schema
3. Going forward, always use `npx prisma migrate dev` to create migrations when changing schema.prisma

## Verification Commands

```bash
# Check if migrations are applied
npx prisma migrate status

# Verify database schema matches Prisma schema
npx prisma db pull --print

# Check specific constraints
psql -d sales_commission_db -c "\d users" | grep is_manager
psql -d sales_commission_db -c "\d deals" | grep unique_crm_deal_per_company
```