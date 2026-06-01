-- Add certificate fields to donations table
ALTER TABLE "donations"
  ADD COLUMN IF NOT EXISTS "certificate_requested"     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "certificate_requested_at"  TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "certificate_url"           VARCHAR(500);
