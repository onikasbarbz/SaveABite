-- AlterTable
ALTER TABLE "donations" ALTER COLUMN "status" TYPE VARCHAR(30);

ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "proof_deadline_at" TIMESTAMPTZ(6);
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "proof_image_url" VARCHAR(500);
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "proof_uploaded_at" TIMESTAMPTZ(6);

-- Migrate legacy NGO-confirmed pickups to proof-pending (restaurant must re-confirm in app if needed)
UPDATE "donations"
SET "status" = 'proof_pending',
    "proof_deadline_at" = COALESCE("picked_up_at", NOW()) + INTERVAL '24 hours'
WHERE "status" = 'picked_up' AND "proof_image_url" IS NULL;

UPDATE "donations"
SET "status" = 'verified',
    "proof_uploaded_at" = COALESCE("proof_uploaded_at", "picked_up_at")
WHERE "status" = 'picked_up' AND "proof_image_url" IS NOT NULL;
