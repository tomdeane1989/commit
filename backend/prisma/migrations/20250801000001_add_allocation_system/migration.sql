-- CreateTable
CREATE TABLE "allocation_patterns" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "pattern_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "base_period_type" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allocation_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation_periods" (
    "id" TEXT NOT NULL,
    "allocation_pattern_id" TEXT NOT NULL,
    "period_name" VARCHAR(50) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "allocation_percentage" DECIMAL(5,2) NOT NULL,
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allocation_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "target_allocations" (
    "id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "allocation_period_id" TEXT NOT NULL,
    "period_quota_amount" DECIMAL(12,2) NOT NULL,
    "period_start_date" DATE NOT NULL,
    "period_end_date" DATE NOT NULL,
    "allocation_percentage" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "target_allocations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "allocation_patterns" ADD CONSTRAINT "allocation_patterns_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_patterns" ADD CONSTRAINT "allocation_patterns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_periods" ADD CONSTRAINT "allocation_periods_allocation_pattern_id_fkey" FOREIGN KEY ("allocation_pattern_id") REFERENCES "allocation_patterns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_allocations" ADD CONSTRAINT "target_allocations_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_allocations" ADD CONSTRAINT "target_allocations_allocation_period_id_fkey" FOREIGN KEY ("allocation_period_id") REFERENCES "allocation_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "allocation_patterns_company_id_idx" ON "allocation_patterns"("company_id");

-- CreateIndex
CREATE INDEX "allocation_patterns_pattern_name_idx" ON "allocation_patterns"("pattern_name");

-- CreateIndex
CREATE INDEX "allocation_patterns_is_active_idx" ON "allocation_patterns"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "allocation_patterns_company_id_pattern_name_key" ON "allocation_patterns"("company_id", "pattern_name");

-- CreateIndex
CREATE INDEX "allocation_periods_allocation_pattern_id_idx" ON "allocation_periods"("allocation_pattern_id");

-- CreateIndex
CREATE INDEX "allocation_periods_start_date_idx" ON "allocation_periods"("start_date");

-- CreateIndex
CREATE INDEX "allocation_periods_end_date_idx" ON "allocation_periods"("end_date");

-- CreateIndex
CREATE INDEX "allocation_periods_sort_order_idx" ON "allocation_periods"("sort_order");

-- CreateIndex
CREATE INDEX "target_allocations_target_id_idx" ON "target_allocations"("target_id");

-- CreateIndex
CREATE INDEX "target_allocations_allocation_period_id_idx" ON "target_allocations"("allocation_period_id");

-- CreateIndex
CREATE INDEX "target_allocations_period_start_date_idx" ON "target_allocations"("period_start_date");

-- CreateIndex
CREATE INDEX "target_allocations_period_end_date_idx" ON "target_allocations"("period_end_date");

-- CreateIndex
CREATE UNIQUE INDEX "target_allocations_target_id_allocation_period_id_key" ON "target_allocations"("target_id", "allocation_period_id");

-- Add allocation_pattern_id to targets table (check if columns exist first)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'targets' AND column_name = 'allocation_pattern_id') THEN
        ALTER TABLE "targets" ADD COLUMN "allocation_pattern_id" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'targets' AND column_name = 'annual_quota_amount') THEN
        ALTER TABLE "targets" ADD COLUMN "annual_quota_amount" DECIMAL(12,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'targets' AND column_name = 'target_year') THEN
        ALTER TABLE "targets" ADD COLUMN "target_year" INTEGER;
    END IF;
END $$;

-- AddForeignKey (check if constraint doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'targets_allocation_pattern_id_fkey') THEN
        ALTER TABLE "targets" ADD CONSTRAINT "targets_allocation_pattern_id_fkey" FOREIGN KEY ("allocation_pattern_id") REFERENCES "allocation_patterns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateIndex (check if indexes don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'targets_allocation_pattern_id_idx') THEN
        CREATE INDEX "targets_allocation_pattern_id_idx" ON "targets"("allocation_pattern_id");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'targets_target_year_idx') THEN
        CREATE INDEX "targets_target_year_idx" ON "targets"("target_year");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'targets_user_id_target_year_team_target_key') THEN
        CREATE UNIQUE INDEX "targets_user_id_target_year_team_target_key" ON "targets"("user_id", "target_year", "team_target") WHERE "target_year" IS NOT NULL;
    END IF;
END $$;

-- Insert default allocation patterns for existing companies
INSERT INTO "allocation_patterns" (id, company_id, pattern_name, description, base_period_type, created_by_id)
SELECT 
    gen_random_uuid(),
    c.id,
    'Even Quarterly Distribution',
    'Equal 25% allocation across four quarters',
    'quarterly',
    (SELECT u.id FROM users u WHERE u.company_id = c.id AND u.is_admin = true LIMIT 1)
FROM companies c
WHERE EXISTS (SELECT 1 FROM users u WHERE u.company_id = c.id AND u.is_admin = true);

-- Insert quarterly periods for default pattern
INSERT INTO "allocation_periods" (id, allocation_pattern_id, period_name, start_date, end_date, allocation_percentage, sort_order)
SELECT 
    gen_random_uuid(),
    ap.id,
    'Q' || q.quarter || ' ' || EXTRACT(YEAR FROM CURRENT_DATE)::text,
    DATE(EXTRACT(YEAR FROM CURRENT_DATE)::text || '-' || LPAD(((q.quarter - 1) * 3 + 1)::text, 2, '0') || '-01'),
    (DATE(EXTRACT(YEAR FROM CURRENT_DATE)::text || '-' || LPAD((q.quarter * 3)::text, 2, '0') || '-01') + INTERVAL '1 month' - INTERVAL '1 day')::date,
    25.00,
    q.quarter
FROM allocation_patterns ap
CROSS JOIN (SELECT 1 as quarter UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) q
WHERE ap.pattern_name = 'Even Quarterly Distribution';