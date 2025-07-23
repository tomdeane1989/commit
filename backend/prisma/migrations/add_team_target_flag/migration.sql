-- Add team_target flag to targets table
ALTER TABLE "targets" ADD COLUMN "team_target" BOOLEAN DEFAULT false;

-- Add index for team targets
CREATE INDEX "targets_team_target_idx" ON "targets"("team_target");