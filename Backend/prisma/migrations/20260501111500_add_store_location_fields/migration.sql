-- Idempotent store / profile columns (may already exist from introspection).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(50);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "store_name" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "store_lat" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "store_lng" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "store_address" VARCHAR(500);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_image" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cover_image" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "identity_document" VARCHAR(255);

CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users"("email");
