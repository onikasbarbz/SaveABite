-- Schema for saveabite_app database
-- Generated from auth.routes.js usage

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  full_name   VARCHAR(255) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  phone       VARCHAR(50),
  password    VARCHAR(255) NOT NULL,
  role        VARCHAR(50) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster login lookups by email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
