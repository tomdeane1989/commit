-- Add commission tracking fields to deals table
ALTER TABLE "deals" 
ADD COLUMN IF NOT EXISTS "projected_commission" DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "actual_commission" DECIMAL(12,2) DEFAULT 0;

-- Add commission type and trigger tracking to commissions table
ALTER TABLE "commissions" 
ADD COLUMN IF NOT EXISTS "commission_type" VARCHAR(20) DEFAULT 'actual',
ADD COLUMN IF NOT EXISTS "last_calculated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "calculation_trigger" VARCHAR(50);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "deals_projected_commission_idx" ON "deals"("projected_commission");
CREATE INDEX IF NOT EXISTS "deals_actual_commission_idx" ON "deals"("actual_commission");
CREATE INDEX IF NOT EXISTS "commissions_type_idx" ON "commissions"("commission_type");
CREATE INDEX IF NOT EXISTS "commissions_last_calculated_idx" ON "commissions"("last_calculated_at");

-- Add unique constraint for commission records (user + period + type)
ALTER TABLE "commissions" 
ADD CONSTRAINT "unique_user_period_type" 
UNIQUE ("user_id", "period_start", "period_end", "commission_type");