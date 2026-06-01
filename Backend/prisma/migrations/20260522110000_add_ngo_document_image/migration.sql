-- Add document_image column to ngo_registrations if it doesn't exist
-- This column stores the path to the NGO's uploaded verification document
ALTER TABLE "ngo_registrations"
  ADD COLUMN IF NOT EXISTS "document_image" VARCHAR(255);
