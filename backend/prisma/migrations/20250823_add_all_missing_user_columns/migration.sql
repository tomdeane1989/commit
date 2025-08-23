-- Add all missing columns to users table if they don't exist
-- These columns exist in the schema but were missing from production

-- Security-related columns
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_reset_token" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_reset_expires" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_enabled" BOOLEAN DEFAULT FALSE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_secret" TEXT;

-- Note: employee_id and last_activity are handled by previous migrations