-- Add payment_method column to reservations
ALTER TABLE "reservations"
  ADD COLUMN IF NOT EXISTS "payment_method" VARCHAR(20) DEFAULT 'online';
