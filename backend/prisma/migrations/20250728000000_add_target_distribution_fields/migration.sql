-- Add target distribution and relationship fields
ALTER TABLE "targets" ADD COLUMN "distribution_method" TEXT DEFAULT 'even';
ALTER TABLE "targets" ADD COLUMN "distribution_config" JSONB;
ALTER TABLE "targets" ADD COLUMN "parent_target_id" TEXT;

-- Add foreign key constraint for parent_target_id
ALTER TABLE "targets" ADD CONSTRAINT "targets_parent_target_id_fkey" 
FOREIGN KEY ("parent_target_id") REFERENCES "targets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for performance
CREATE INDEX "targets_parent_target_id_idx" ON "targets"("parent_target_id");
CREATE INDEX "targets_distribution_method_idx" ON "targets"("distribution_method");

-- Update migration_lock.toml timestamp
-- This ensures proper migration ordering