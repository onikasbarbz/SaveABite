CREATE TABLE IF NOT EXISTS "notifications" (
  "id"         SERIAL PRIMARY KEY,
  "user_id"    INTEGER NOT NULL,
  "title"      VARCHAR(255) NOT NULL,
  "message"    TEXT NOT NULL,
  "is_read"    BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "notifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_notifications_user_id" ON "notifications"("user_id");
