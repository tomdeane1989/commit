-- Remove redundant team target aggregation records
-- This migration removes aggregated team targets and sets all targets to individual (team_target = false)

-- 1. Deactivate aggregated team targets (targets where the user also has an individual target)
UPDATE targets t1
SET is_active = false
WHERE t1.team_target = true
AND EXISTS (
  SELECT 1 
  FROM targets t2 
  WHERE t2.user_id = t1.user_id 
  AND t2.team_target = false 
  AND t2.is_active = true
  AND t1.id != t2.id
);

-- 2. Set all remaining active targets to team_target = false
-- Since we're moving to dynamic team aggregation
UPDATE targets
SET team_target = false
WHERE is_active = true;