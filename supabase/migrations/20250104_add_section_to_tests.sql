-- Add section column to tests table (S1, S2, S3, etc.)
ALTER TABLE tests ADD COLUMN IF NOT EXISTS section text;
