-- Add is_banned column to users table, defaulting to false so all existing users are Active
ALTER TABLE "users" ADD COLUMN "is_banned" BOOLEAN NOT NULL DEFAULT false;
