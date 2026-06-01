-- Add driver assignment, delivery timestamp, and rating to reservations
ALTER TABLE "reservations"
  ADD COLUMN IF NOT EXISTS "driver_id"    INTEGER       REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "driver_name"  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "driver_phone" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "driver_rating" SMALLINT;
