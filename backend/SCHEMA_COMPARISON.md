# Schema Comparison Report

## Summary
Comparison between Prisma schema and actual PostgreSQL database on this machine.

## ✅ Verified Working

### 1. Unique Constraints
- **deals**: `unique_crm_deal_per_company` on `[crm_id, company_id]` ✅
- **teams**: `teams_company_id_team_name_key` on `[company_id, team_name]` ✅  
- **team_members**: `team_members_user_id_team_id_key` on `[user_id, team_id]` ✅

### 2. Critical Columns
- **users.is_manager**: EXISTS ✅
- **users.is_admin**: EXISTS ✅
- **targets.team_id**: EXISTS ✅
- **deals.crm_id**: EXISTS ✅

### 3. Tables
All tables from Prisma schema exist in database:
- users ✅
- companies ✅
- deals ✅
- deal_categorizations ✅
- targets ✅
- commissions ✅
- commission_details ✅
- crm_integrations ✅
- activity_log ✅
- teams ✅
- team_members ✅

## 🔍 Recommendations

1. **Migration Sync**: The database appears to be in sync with the Prisma schema after our manual fixes
2. **Future Changes**: Always use `npx prisma migrate dev` to create tracked migrations
3. **Cross-Machine Sync**: Ensure all migration files are committed and pulled on both machines

## Commands to Verify

```bash
# Check all unique constraints
psql -d sales_commission_db -c "
SELECT tc.table_name, tc.constraint_name, 
       string_agg(kcu.column_name, ', ') as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE' 
  AND tc.table_schema = 'public'
GROUP BY tc.table_name, tc.constraint_name;"

# Check specific table structure
psql -d sales_commission_db -c "\d table_name"

# Compare with Prisma schema
npx prisma db pull --print
```