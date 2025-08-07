-- Add is_manager column to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_manager" BOOLEAN NOT NULL DEFAULT false;

-- Update existing managers based on role
UPDATE "users" SET "is_manager" = true WHERE "role" = 'manager';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS "users_is_manager_idx" ON "users"("is_manager");