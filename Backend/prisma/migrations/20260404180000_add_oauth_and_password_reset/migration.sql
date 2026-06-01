-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token_expiry" TIMESTAMPTZ(6);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_id_key" ON "users"("google_id");

-- AlterTable (Google-only accounts have no password hash)
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;
