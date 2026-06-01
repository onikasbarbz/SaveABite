-- Idempotent baseline: safe when UserRole / users already exist (introspected DB).
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('business', 'driver', 'consumer', 'ngo');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
