-- Idempotent: admin enum value + password reset columns (snake_case).
DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'admin';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token_expiry" TIMESTAMPTZ(6);
