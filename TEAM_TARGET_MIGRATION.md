# Team Target Migration Documentation

## Overview
This document describes the migration from static team target records to dynamic team target aggregation.

## Previous Approach (Deprecated)
- Team targets were stored as separate records with `team_target = true`
- Managers had both individual targets AND aggregated team target records
- This created redundancy and potential sync issues

## New Approach (Current)
- All targets are individual targets (`team_target = false`)
- Team targets are calculated dynamically by aggregating all team members' individual targets
- No separate team target records exist in the database

## Database Changes

### Migration Applied
- Deactivated all aggregated team target records (e.g., Tom's £720,000 team target)
- Set all remaining active targets to `team_target = false`
- The `team_target` field is now effectively deprecated but retained for backwards compatibility

### Data Structure
```sql
-- All targets are now individual
SELECT * FROM targets WHERE is_active = true;
-- Returns only individual targets for each user

-- Team aggregation is calculated on-the-fly
SELECT SUM(t.quota_amount) as team_total
FROM targets t
JOIN users u ON t.user_id = u.id
WHERE t.is_active = true
AND (u.manager_id = 'manager_id' OR u.id = 'manager_id')
AND t.period_start = '2025-01-01';
```

## API Changes

### New Endpoint: `/targets/team-aggregate`
Returns dynamically calculated team targets grouped by period:
```json
{
  "team_aggregates": [{
    "period_type": "annual",
    "period_start": "2025-01-01",
    "period_end": "2025-12-31",
    "commission_rate": 0.05,
    "total_quota": 840000,
    "member_count": 4,
    "member_targets": [{
      "user": { "id": "...", "first_name": "Tom", "last_name": "Deane" },
      "quota_amount": 120000,
      "target_id": "..."
    }]
  }],
  "team_members": [...],
  "success": true
}
```

## Frontend Changes

### Targets Page
- Displays "Team Target (Aggregated)" as a collapsible section
- Shows individual team member targets when expanded
- Indicates team targets are "Dynamically calculated"
- No progress bars on targets page (available elsewhere in app)

## Benefits

1. **Single Source of Truth**: Each person has exactly one target
2. **Flexibility**: Easy to override individual targets without breaking team calculations
3. **Accuracy**: Team totals always reflect current individual targets
4. **Simplicity**: No need to maintain sync between individual and aggregated targets

## Migration Script
A cleanup script was run to:
1. Identify managers with duplicate targets (individual + team)
2. Deactivate aggregated team target records
3. Update all remaining targets to `team_target = false`

## Future Considerations
- The `team_target` field could be removed entirely in a future migration
- Additional filters can be added to team aggregation (e.g., by role, territory)
- Historical team target tracking can be implemented by storing snapshots