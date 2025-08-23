-- Add last_activity column to users table if it doesn't exist
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_activity" TIMESTAMP(3);