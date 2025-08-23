-- Add employee_id column to users table if it doesn't exist
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "employee_id" TEXT;